import fs from "fs";
import path from "path";

export const getPublicPath = (): string => {
  const candidates = Array.from(
    new Set([
      path.resolve(__dirname, "../../../public"),
      path.resolve(process.cwd(), "public"),
      path.resolve(process.cwd(), "../public"),
    ])
  );

  const publicPath = candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isDirectory();
    } catch {
      return false;
    }
  });

  if (!publicPath) {
    throw new Error(`Public directory not found. Checked: ${candidates.join(", ")}`);
  }

  return publicPath;
};
