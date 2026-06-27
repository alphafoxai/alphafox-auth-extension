/* eslint-disable react/jsx-no-literals */
export const col = (top: any, bottom: any) => (
  <div className="flex flex-col justify-between">
    <div className="text-sm text-muted-foreground">{top}</div>
    <div className="font-semibold break-all flex-wrap">{bottom}</div>
  </div>
);

export const row = (left: any, right: any) => (
  <div className="grid grid-cols-2 gap-4">
    <div className="text-sm text-muted-foreground">{left}</div>
    <div className="break-all font-semibold">{right}</div>
  </div>
);

export const color = (
  beforeSlash: any,
  afterSlash: any,
  colorConfig = {
    before: "text-green-700",
    after: "",
  }
) => (
  <span>
    <span className={colorConfig.before}>{beforeSlash}</span> /{" "}
    <span className={colorConfig.after}>{afterSlash}</span>
  </span>
);

export const multiColor = (
  beforeSlash: any,
  afterSlash: any,
  afterSlash2: any,
  colorConfig = {
    before: "text-green-700",
    after: "",
    after2: "",
  }
) => (
  <span>
    <span className={colorConfig.before}>{beforeSlash}</span> /{" "}
    <span className={colorConfig.after}>{afterSlash}</span> /{" "}
    <span className={colorConfig.after2}>{afterSlash2}</span>
  </span>
);
