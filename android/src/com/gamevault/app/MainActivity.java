package com.gamevault.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * GameVault para Android.
 *
 * La interfaz es la misma app React que en Windows (assets/www). Se sirve desde
 * https://app.gamevault/ (origen seguro → IndexedDB persistente) interceptando las
 * peticiones de la WebView. Además ofrece:
 *   · /__proxy  → peticiones HTTP nativas a HowLongToBeat / VGChartz / RAWG sin CORS.
 *                 La URL, método, cabeceras y cuerpo llegan en cabeceras X-GV-*.
 *   · window.GVAndroid.saveFile(nombre, texto, mime) → guarda en Descargas.
 *   · selector de archivos para <input type="file"> (importar JSON/Excel/Word, fotos).
 */
public class MainActivity extends Activity {
    private static final String HOST = "app.gamevault";
    private static final String ORIGIN = "https://" + HOST + "/";
    private static final int FILE_CHOOSER = 1001;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (CookieHandler.getDefault() == null) CookieHandler.setDefault(new CookieManager());

        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#080810"));
        w.setNavigationBarColor(Color.parseColor("#080810"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#080810"));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setSupportMultipleWindows(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " GameVaultAndroid/1.8");

        web.addJavascriptInterface(new Bridge(), "GVAndroid");
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new Chrome());

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(ORIGIN + "index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    // ── Servir la app y el proxy ──────────────────────────────────────────────
    private class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (!HOST.equals(u.getHost())) return null;          // el resto (imágenes de RAWG…) va normal
            String path = u.getPath();
            if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
            if (path.equals("/__proxy")) return proxy(req.getRequestHeaders());
            return asset(path);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri u = req.getUrl();
            if (HOST.equals(u.getHost())) return false;
            // Enlaces externos (p.ej. ficha de VGChartz) → navegador del sistema
            try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
            return true;
        }
    }

    private WebResourceResponse asset(String path) {
        try {
            String clean = path.replace("..", "");
            InputStream in = getAssets().open("www" + clean);
            Map<String, String> h = new HashMap<String, String>();
            h.put("Cache-Control", "no-cache");
            return new WebResourceResponse(mime(clean), mime(clean).startsWith("text/") || clean.endsWith(".js") || clean.endsWith(".json") ? "utf-8" : null,
                    200, "OK", h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                    new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String mime(String p) {
        String l = p.toLowerCase();
        if (l.endsWith(".html")) return "text/html";
        if (l.endsWith(".js")) return "application/javascript";
        if (l.endsWith(".css")) return "text/css";
        if (l.endsWith(".json")) return "application/json";
        if (l.endsWith(".wasm")) return "application/wasm";
        if (l.endsWith(".png")) return "image/png";
        if (l.endsWith(".jpg") || l.endsWith(".jpeg")) return "image/jpeg";
        if (l.endsWith(".svg")) return "image/svg+xml";
        if (l.endsWith(".ico")) return "image/x-icon";
        if (l.endsWith(".woff2")) return "font/woff2";
        if (l.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static String header(Map<String, String> h, String name) {
        for (Map.Entry<String, String> e : h.entrySet()) if (e.getKey() != null && e.getKey().equalsIgnoreCase(name)) return e.getValue();
        return null;
    }

    /** Ejecuta la petición indicada en las cabeceras X-GV-* y devuelve la respuesta tal cual */
    private WebResourceResponse proxy(Map<String, String> reqHeaders) {
        Map<String, String> out = new HashMap<String, String>();
        out.put("Access-Control-Allow-Origin", "*");
        out.put("Cache-Control", "no-store");
        HttpURLConnection c = null;
        try {
            String target = header(reqHeaders, "X-GV-Url");
            String method = header(reqHeaders, "X-GV-Method");
            String hdrs = header(reqHeaders, "X-GV-Headers");
            String body = header(reqHeaders, "X-GV-Body");
            if (target == null || !(target.startsWith("https://") || target.startsWith("http://")))
                throw new Exception("URL no válida");
            if (method == null) method = "GET";

            c = (HttpURLConnection) new URL(target).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(20000);
            c.setReadTimeout(25000);
            c.setRequestMethod(method);
            if (hdrs != null) {
                JSONObject j = new JSONObject(new String(Base64.decode(hdrs, Base64.DEFAULT), "UTF-8"));
                Iterator<String> it = j.keys();
                while (it.hasNext()) { String k = it.next(); c.setRequestProperty(k, j.optString(k)); }
            }
            if (body != null) {
                byte[] b = Base64.decode(body, Base64.DEFAULT);
                c.setDoOutput(true);
                c.setFixedLengthStreamingMode(b.length);
                OutputStream os = c.getOutputStream();
                os.write(b);
                os.close();
            }
            int status = c.getResponseCode();
            InputStream in = status >= 400 ? c.getErrorStream() : c.getInputStream();
            byte[] data = in == null ? new byte[0] : readAll(in);
            out.put("X-GV-Status", String.valueOf(status));
            String ct = c.getContentType();
            return new WebResourceResponse(ct != null && ct.contains("json") ? "application/json" : "text/plain", "utf-8",
                    200, "OK", out, new ByteArrayInputStream(data));
        } catch (Exception e) {
            out.put("X-GV-Status", "599");
            String msg = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "" : e.getMessage());
            try {
                return new WebResourceResponse("text/plain", "utf-8", 200, "OK", out, new ByteArrayInputStream(msg.getBytes("UTF-8")));
            } catch (Exception e2) { return null; }
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static byte[] readAll(InputStream in) throws Exception {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        in.close();
        return bo.toByteArray();
    }

    // ── Puente JavaScript ─────────────────────────────────────────────────────
    private class Bridge {
        /** Guarda un fichero en Descargas. Devuelve la ruta (o "" si falla). */
        @JavascriptInterface
        public String saveFile(String name, String text, String mime) {
            try {
                byte[] data = text.getBytes("UTF-8");
                if (mime == null || mime.isEmpty()) mime = "application/json";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/GameVault");
                    ContentResolver cr = getContentResolver();
                    Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return "";
                    OutputStream os = cr.openOutputStream(uri);
                    os.write(data);
                    os.close();
                    return "Descargas/GameVault/" + name;
                } else {
                    File dir = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "GameVault");
                    dir.mkdirs();
                    File f = new File(dir, name);
                    FileOutputStream fo = new FileOutputStream(f);
                    fo.write(data);
                    fo.close();
                    return f.getAbsolutePath();
                }
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public String version() { return "1.8.0"; }
    }

    // ── Selector de archivos (<input type="file">) ────────────────────────────
    private class Chrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            String[] types = params.getAcceptTypes();
            boolean images = types != null && types.length > 0 && types[0] != null && types[0].startsWith("image");
            i.setType(images ? "image/*" : "*/*");
            if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
            try {
                startActivityForResult(Intent.createChooser(i, "Elegir archivo"), FILE_CHOOSER);
            } catch (Exception e) {
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != FILE_CHOOSER || fileCallback == null) { super.onActivityResult(requestCode, resultCode, data); return; }
        Uri[] result = null;
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                result = new Uri[clip.getItemCount()];
                for (int k = 0; k < clip.getItemCount(); k++) result[k] = clip.getItemAt(k).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{ data.getData() };
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }
}
