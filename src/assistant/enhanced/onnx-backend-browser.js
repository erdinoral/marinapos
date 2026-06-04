/**
 * @xenova/transformers icin onnx.js yerine — yalnizca onnxruntime-web (Electron renderer).
 */
import * as ONNX_WEB from "onnxruntime-web";

export const ONNX = ONNX_WEB.default ?? ONNX_WEB;

export const executionProviders = ["wasm"];

const isIOS =
  typeof navigator !== "undefined" && /iP(hone|od|ad).+16_4.+AppleWebKit/.test(navigator.userAgent);
if (isIOS && ONNX?.env?.wasm) {
  ONNX.env.wasm.simd = false;
}
