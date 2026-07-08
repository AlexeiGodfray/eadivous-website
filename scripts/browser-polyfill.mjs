import { Window } from 'happy-dom';

const browserWindow = new Window({
  url: 'http://localhost/',
  width: 1024,
  height: 1024,
});

globalThis.window = browserWindow;
globalThis.document = browserWindow.document;
globalThis.FileReader = browserWindow.FileReader;
globalThis.Image = browserWindow.Image;
globalThis.HTMLCanvasElement = browserWindow.HTMLCanvasElement;
globalThis.URL = browserWindow.URL;
globalThis.Blob = browserWindow.Blob;
globalThis.DOMParser = browserWindow.DOMParser;
globalThis.XMLHttpRequest = browserWindow.XMLHttpRequest;
globalThis.requestAnimationFrame = browserWindow.requestAnimationFrame.bind(browserWindow);
globalThis.cancelAnimationFrame = browserWindow.cancelAnimationFrame.bind(browserWindow);
