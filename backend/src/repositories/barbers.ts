import supabase from "../config/supabase";
import { removeUploadedImage, uploadImage } from "../config/tools";
import { randomUUID } from "node:crypto";


export type Barber = {
  id: string;
  name: string;
  photo_url: string;
};

export async function getBarbers() {
  const { data, error } = await supabase
    .from("barbers")
    .select("id, name, photo_url")
    .order("created_at");

  if (error) {
    throw error;
  }


  return Promise.all(
    (data ?? []).map(async (barber) => {
      if (!barber.photo_url || /^https?:\/\//i.test(barber.photo_url)) return barber;

      const { data: signedImage } = await supabase.storage
        .from("barbers")
        .createSignedUrl(barber.photo_url, 60 * 60);

      return { ...barber, photo_url: signedImage?.signedUrl ?? null };
    })
  );
}

export async function barberExists(barberId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}


export async function createBarber(
  barber: Pick<Barber, "name">,
  image: Express.Multer.File
): Promise<Barber> {
  const folderName = randomUUID();
  const uploaded = await uploadImage("barbers", folderName, image);

  const { data, error } = await supabase
    .from("barbers")
    .insert({ ...barber, photo_url: uploaded.publicUrl })
    .select("id, name, photo_url")
    .single();

  if (error || !data) {
    await removeUploadedImage("barbers", uploaded.imagePath);
    throw new Error(`Erro ao criar o barbeiro: ${error?.message ?? "resposta vazia"}`);
  }

  return data as Barber;
}
