import supabase from "../config/supabase";
import { removeUploadedImage, uploadImage } from "../config/tools";
import { randomUUID } from "node:crypto";


export type Barber = {
  id: string;
  name: string;
  photo_url: string;
};

const barberExistenceCache = new Map<string, number>();
const BARBER_CACHE_MS = 5 * 60 * 1000;

export async function getBarbers() {
  const { data, error } = await supabase
    .from("barbers")
    .select("id, name, photo_url")
    .order("created_at");

  if (error) {
    throw error;
  }


  const barbers = await Promise.all(
    (data ?? []).map(async (barber) => {
      if (!barber.photo_url || /^https?:\/\//i.test(barber.photo_url)) return barber;

      const { data: signedImage } = await supabase.storage
        .from("barbers")
        .createSignedUrl(barber.photo_url, 60 * 60);

      return { ...barber, photo_url: signedImage?.signedUrl ?? null };
    })
  );

  const expiresAt = Date.now() + BARBER_CACHE_MS;
  for (const barber of barbers) barberExistenceCache.set(barber.id, expiresAt);
  return barbers;
}

export async function barberExists(barberId: string): Promise<boolean> {
  const cachedUntil = barberExistenceCache.get(barberId);
  if (cachedUntil && cachedUntil > Date.now()) return true;

  const { data, error } = await supabase
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  barberExistenceCache.set(barberId, Date.now() + BARBER_CACHE_MS);
  return true;
}

export async function getBarberName(barberId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("barbers")
    .select("name")
    .eq("id", barberId)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.name === "string" ? data.name : null;
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

  barberExistenceCache.set(data.id, Date.now() + BARBER_CACHE_MS);
  return data as Barber;
}
