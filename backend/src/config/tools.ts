import sharp from "sharp";
import supabase from "./supabase";

type ImageFormatOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  background?: { r: number; g: number; b: number; alpha: number };
};

export async function imageFormat(
  folderName: string,
  image: Express.Multer.File,
  options: ImageFormatOptions = {}
): Promise<{ imagePath: string; compressedBuffer: Buffer }> {
  const imagePath = `${folderName}/image.webp`;

  const compressedBuffer = await sharp(image.buffer, {
    failOn: "error",
    limitInputPixels: 40_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: options.width ?? 1600,
      height: options.height,
      fit: options.fit ?? "cover",
      position: "centre",
      background: options.background,
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return { imagePath, compressedBuffer };
}

export async function uploadImage(
  bucket: "barbers" | "inventory",
  folderName: string,
  image: Express.Multer.File,
  options: ImageFormatOptions = {}
): Promise<{ imagePath: string; publicUrl: string }> {
  const { imagePath, compressedBuffer } = await imageFormat(folderName, image, options);
  const { error } = await supabase.storage.from(bucket).upload(imagePath, compressedBuffer, {
    contentType: "image/webp",
    upsert: false,
  });

  if (error) {
    throw new Error(`Erro ao enviar a imagem: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(imagePath);
  return { imagePath, publicUrl: data.publicUrl };
}

export async function removeUploadedImage(
  bucket: "barbers" | "inventory",
  imagePath: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([imagePath]);
  if (error) console.error("Erro ao remover imagem após falha:", error);
}
