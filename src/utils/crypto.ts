/**
 * Cryptographic primitives for Android TV Remote v2 Protocol:
 * - RSA Key pair and self-signed X.509 certificate generation via node-forge
 * - SHA-256 pairing proof derivation
 */

import forge from 'node-forge';
import { StoredCertificate } from '../types/device';

/**
 * Generates an RSA key pair and a self-signed X.509 certificate.
 * Valid for 10 years so pairing remains valid across app sessions.
 */
export async function generateClientCertificate(
  commonName: string = 'atvremote-client'
): Promise<StoredCertificate> {
  return new Promise((resolve, reject) => {
    try {
      // Generate 2048-bit RSA key pair asynchronously
      forge.pki.rsa.generateKeyPair({ bits: 2048, workers: -1 }, (err, keypair) => {
        if (err) {
          return reject(err);
        }

        const cert = forge.pki.createCertificate();
        cert.publicKey = keypair.publicKey;
        cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(16));

        // Validity period: 10 years
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

        const attrs = [
          { name: 'commonName', value: commonName },
          { name: 'organizationName', value: 'Android TV Remote Client' },
        ];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        // Self-sign certificate using SHA-256
        cert.sign(keypair.privateKey, forge.md.sha256.create());

        const clientCertPem = forge.pki.certificateToPem(cert);
        const clientKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);

        resolve({
          clientCertPem,
          clientKeyPem,
          createdAt: Date.now(),
        });
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Computes the SHA-256 pairing proof verification bytes from:
 * - Client certificate (DER or ASN1 bytes)
 * - Server certificate (DER or ASN1 bytes)
 * - Entered PIN string (e.g. "A1B2C3" or "123456")
 */
export function computePairingSecret(
  clientCertPem: string,
  serverCertPem: string,
  pin: string
): Uint8Array {
  try {
    const clientCert = forge.pki.certificateFromPem(clientCertPem);
    const clientDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(clientCert)).getBytes();

    const serverCert = forge.pki.certificateFromPem(serverCertPem);
    const serverDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(serverCert)).getBytes();

    // SHA-256 digest of clientDerBytes + serverDerBytes + PIN
    const md = forge.md.sha256.create();
    md.update(clientDerBytes);
    md.update(serverDerBytes);
    md.update(pin.trim().toUpperCase());

    const digestBytes = md.digest().getBytes();
    const result = new Uint8Array(digestBytes.length);
    for (let i = 0; i < digestBytes.length; i++) {
      result[i] = digestBytes.charCodeAt(i);
    }
    return result;
  } catch (error) {
    // Fallback: SHA-256 directly on combined strings
    const md = forge.md.sha256.create();
    md.update(clientCertPem);
    md.update(serverCertPem);
    md.update(pin.trim().toUpperCase());
    const digestBytes = md.digest().getBytes();
    const result = new Uint8Array(digestBytes.length);
    for (let i = 0; i < digestBytes.length; i++) {
      result[i] = digestBytes.charCodeAt(i);
    }
    return result;
  }
}
