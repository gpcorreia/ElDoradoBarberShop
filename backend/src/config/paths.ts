import fs from "fs";
import path from "path";

export const getPublicPath = (): string => {
  const candidates = Array.from(
    new Set([
      path.resolve(__dirname, "../../public"), // Source: backend/src/config
      path.resolve(__dirname, "../../../public"), // Compiled: backend/dist/src/config
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
