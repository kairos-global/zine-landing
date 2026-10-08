import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const source = readFileSync(new URL('../src/lib/qr-scan.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { classifyQRCode } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const base = 'https://www.zineground.com';
const id = 'e76df81d-822b-4cd5-85d4-17d55b3f6a80';
const qrPath = `/qr/${id}/${id}`;

test('existing native link and collection formats open through their tracked routes', () => {
  for (const host of [base, 'https://zineground.com']) {
    for (const path of [qrPath, `/collect/${id}`]) {
      const result = classifyQRCode(host + path, base);
      assert.equal(result.kind, 'native');
      assert.equal(result.url, host + path);
    }
  }
});

test('lookalike domains, userinfo, unsafe schemes, and arbitrary routes never auto-open', () => {
  const payloads = [
    `https://www.zineground.com.evil.example${qrPath}`,
    `https://www.zineground.com@evil.example${qrPath}`,
    `https://evil.example@www.zineground.com${qrPath}`,
    `http://www.zineground.com${qrPath}`,
    `https://www.zineground.com:444${qrPath}`,
    `${base}/dashboard`, `${base}/qr/not-a-real-id/not-a-real-id`,
    `${base}${qrPath}?redirect=https://evil.example`, `${base}${qrPath}#foo`,
    'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//evil.example',
  ];
  for (const payload of payloads) assert.notEqual(classifyQRCode(payload, base).kind, 'native', payload);
  for (const payload of payloads.slice(-3)) assert.equal(classifyQRCode(payload, base).url, undefined);
});

test('external websites keep the destination visible and require an explicit open', () => {
  assert.deepEqual(classifyQRCode(' https://example.org/story?q=zine ', base), {
    kind: 'website', title: 'example.org', value: 'https://example.org/story?q=zine', url: 'https://example.org/story?q=zine',
  });
});

test('text, wifi, contacts, email, and phone content cannot execute navigation', () => {
  for (const [value, kind] of [['hello', 'text'], ['WIFI:T:WPA;S:Studio;P:password;;', 'wifi'], ['BEGIN:VCARD\nFN:Artist\nEND:VCARD', 'contact'], ['mailto:hello@example.org', 'email'], ['tel:+15555550123', 'phone']]) {
    const result = classifyQRCode(value, base);
    assert.equal(result.kind, kind);
    assert.equal(result.url, undefined);
  }
});

test('only valid configured HTTPS origins extend native recognition', () => {
  assert.equal(classifyQRCode(`https://preview.example${qrPath}`, 'https://preview.example/').kind, 'native');
  assert.equal(classifyQRCode(`http://preview.example${qrPath}`, 'http://preview.example').kind, 'website');
  assert.equal(classifyQRCode(`https://evil.example${qrPath}`, 'invalid').kind, 'website');
});

test('real generated native, external, text, and inverted QR pixels decode', () => {
  for (const value of [base + qrPath, 'https://example.org/zine', 'A story on paper']) {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const scale = 6, margin = 4, size = (qr.modules.size + margin * 2) * scale;
    for (const inverted of [false, true]) {
      const pixels = new Uint8ClampedArray(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const row = Math.floor(y / scale) - margin, col = Math.floor(x / scale) - margin;
        const dark = row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col);
        const shade = Boolean(dark) !== inverted ? 0 : 255;
        const i = (y * size + x) * 4;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = shade; pixels[i + 3] = 255;
      }
      assert.equal(jsQR(pixels, size, size, { inversionAttempts: 'attemptBoth' })?.data, value);
    }
  }
});
