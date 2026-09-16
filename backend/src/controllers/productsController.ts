import { Request, Response } from "express";
import { createProduct, deactivateProduct, getProducts, PRODUCT_CATEGORIES, ProductCategory } from "../repositories/products";
import { isUuid } from "../config/validation";

export async function handleGetProducts(_req: Request, res: Response) {
  try {
    return res.status(200).json({ products: await getProducts() });
  } catch (error) {
    console.error("Erro ao procurar produtos:", error);
    return res.status(500).json({ message: "Não foi possível carregar os produtos." });
  }
}

export async function handleCreateProduct(req: Request, res: Response) {
  const name = String(req.body?.name ?? "").trim();
  const category = String(req.body?.category ?? "").trim();
  const description = String(req.body?.description ?? "").trim();
  const price = Number(req.body?.price);
  const validCategory = PRODUCT_CATEGORIES.includes(category as ProductCategory);

  if (!name || name.length > 100 || !validCategory || !description || description.length > 1000 || !Number.isFinite(price) || price < 0 || price > 999999.99 || !req.file) {
    return res.status(400).json({
      message: "Preenche nome, categoria, descrição, preço e imagem do produto corretamente.",
      categories: PRODUCT_CATEGORIES,
    });
  }

  try {
    const product = await createProduct({ name, category: category as ProductCategory, description, price }, req.file);
    return res.status(201).json({ message: "Produto criado com sucesso.", product });
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    return res.status(500).json({ message: "Não foi possível criar o produto." });
  }
}

export async function handleDeactivateProduct(req: Request, res: Response) {
  const productId = req.params.productId;
  if (!isUuid(productId)) {
    return res.status(400).json({ message: "O identificador do produto é inválido." });
  }

  try {
    const product = await deactivateProduct(productId);
    if (!product) return res.status(404).json({ message: "Produto não encontrado ou já removido." });

    return res.status(200).json({
      message: "Produto removido da loja com sucesso.",
      product,
    });
  } catch (error) {
    console.error("Erro ao remover produto:", error);
    return res.status(500).json({ message: "Não foi possível remover o produto da loja." });
  }
}
