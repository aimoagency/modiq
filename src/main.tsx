import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// 모바일 입력 가로폭 안정화 — iOS의 date/time 인풋이 width:100%를 무시하고 화면 밖으로 넘치는 고질 버그 방지.
// 전 화면 공통 적용(모바일 폭에서만), 데스크탑은 네이티브 캘린더 아이콘 유지를 위해 제외.
const _inputFix = document.createElement("style");
_inputFix.textContent = `@media (max-width:768px){
  input[type="date"],input[type="time"],input[type="datetime-local"],input[type="month"]{
    -webkit-appearance:none;appearance:none;width:100%;min-width:0;max-width:100%;box-sizing:border-box;
  }
}`;
document.head.appendChild(_inputFix);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
