const { withMainApplication, withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to enable self-signed TLS/SSL WebSocket connections for local Smart TVs
 * Configures OkHttp on Android to accept self-signed certificates on local network connections.
 */
function withSelfSignedTls(config) {
  // 1. Modify AndroidManifest to allow cleartext traffic & network security config
  config = withAndroidManifest(config, (config) => {
    const mainApp = config.modResults.manifest.application[0];
    mainApp.$['android:usesCleartextTraffic'] = 'true';
    return config;
  });

  // 2. Modify MainApplication to install custom OkHttpClientFactory trusting self-signed certs
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Add necessary imports if not already present
    const importsToAdd = `
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.OkHttpClient
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
`;

    if (!contents.includes('OkHttpClientProvider')) {
      contents = contents.replace(/package\s+[\w.]+/, (match) => `${match}\n${importsToAdd}`);
    }

    // Inject OkHttpClientFactory setup inside onCreate
    const factoryCode = `
    try {
      OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {
        override fun createNewNetworkModuleClient(): OkHttpClient {
          val trustAllCerts = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
          })
          val sslContext = SSLContext.getInstance("SSL")
          sslContext.init(null, trustAllCerts, java.security.SecureRandom())
          return OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustAllCerts[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true }
            .cookieJar(ReactCookieJarContainer())
            .connectTimeout(15000, TimeUnit.MILLISECONDS)
            .readTimeout(0, TimeUnit.MILLISECONDS)
            .writeTimeout(0, TimeUnit.MILLISECONDS)
            .build()
        }
      })
    } catch (e: Exception) {
      e.printStackTrace()
    }
`;

    if (!contents.includes('OkHttpClientProvider.setOkHttpClientFactory')) {
      contents = contents.replace(
        /super\.onCreate\(\)/,
        (match) => `${match}\n${factoryCode}`
      );
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withSelfSignedTls;
