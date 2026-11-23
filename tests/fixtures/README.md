# Certificado exclusivo de pruebas

`test-only-cert.pem` y `test-only-key.pem` son un par público de prueba para verificar HTTPS en loopback. La clave está publicada intencionalmente y no protege información real.

No los uses en tu servidor, no los instales como certificados de confianza y no los copies a certs/. El test confía en este certificado únicamente para su conexión HTTPS temporal. La imagen de ejecución no incluye tests/.
