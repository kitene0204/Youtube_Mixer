/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 유튜브 Data API v3 키 (대체 영상 검색용). 없으면 그 기능만 꺼진다. */
  readonly VITE_YT_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
