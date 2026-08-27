import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const menuShiftSchema = z.enum(["lunch", "dinner", "midnight"]);

export const saveCategorySchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  sort_order: z.number().int().min(0).max(999),
  active: z.boolean(),
  menu_shifts: z.array(menuShiftSchema).min(1).max(3),
  originalKey: z.string().trim().max(80).nullable().optional(),
});

export const deleteCategorySchema = z.object({
  id: z.string().uuid(),
});

export async function listAdminConfig() {
  const [
    { data: settings, error: settingsError },
    { data: categories, error: categoriesError },
    { data: products, error: productsError },
  ] = await Promise.all([
    (supabaseAdmin as any).from("store_settings").select("*").limit(1).maybeSingle(),
    (supabaseAdmin as any).from("product_categories").select("*").order("sort_order"),
    (supabaseAdmin as any)
      .from("products")
      .select("id, name, category, image_url, available, sort_order")
      .eq("category", "burgers")
      .order("sort_order"),
  ]);

  if (settingsError) throw settingsError;
  if (categoriesError) throw categoriesError;
  if (productsError) throw productsError;

  return { settings, categories: categories ?? [], products: products ?? [] };
}

export async function saveProductCategory(input: z.infer<typeof saveCategorySchema>) {
  const payload = {
    key: input.key,
    label: input.label,
    sort_order: input.sort_order,
    active: input.active,
    menu_shifts: input.menu_shifts,
  };

  const request = input.id
    ? (supabaseAdmin as any)
        .from("product_categories")
        .update(payload)
        .eq("id", input.id)
        .select()
        .single()
    : (supabaseAdmin as any).from("product_categories").insert(payload).select().single();

  const { data, error } = await request;
  if (error) throw error;

  if (input.originalKey && input.originalKey !== input.key) {
    const { error: productsError } = await (supabaseAdmin as any)
      .from("products")
      .update({ category: input.key })
      .eq("category", input.originalKey);
    if (productsError) throw productsError;
  }

  return data;
}

export async function deleteProductCategory(id: string) {
  const { error } = await (supabaseAdmin as any).from("product_categories").delete().eq("id", id);
  if (error) throw error;
}
