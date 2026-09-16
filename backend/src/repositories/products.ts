import supabase from "../config/supabase";
import { removeUploadedImage, uploadImage } from "../config/tools";
import { randomUUID } from "node:crypto";

export const PRODUCT_CATEGORIES = ["Styling", "Barba", "Cabelo", "Rosto"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  price: number;
  image_url: string;
  active: boolean;
};

export async function getProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, description, price, image_url, active")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createProduct(
  product: Pick<Product, "name" | "category" | "description" | "price">,
  image: Express.Multer.File
): Promise<Product> {
  const folderName = randomUUID();
  const uploaded = await uploadImage("inventory", folderName, image, {
    width: 1200,
    height: 1200,
    fit: "cover",
  });

  const { data, error } = await supabase
    .from("products")
    .insert({ ...product, image_url: uploaded.publicUrl, active: true })
    .select("id, name, category, description, price, image_url, active")
    .single();

  if (error || !data) {
    await removeUploadedImage("inventory", uploaded.imagePath);
    throw new Error(`Erro ao criar o produto: ${error?.message ?? "resposta vazia"}`);
  }

  return data as Product;
}

export async function deactivateProduct(productId: string): Promise<Pick<Product, "id" | "active"> | null> {
  const { data, error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("id", productId)
    .eq("active", true)
    .select("id, active")
    .maybeSingle();

  if (error) throw error;
  return data;
}
