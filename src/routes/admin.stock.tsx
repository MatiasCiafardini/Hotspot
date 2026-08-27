import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  FileText,
  ListChecks,
  LoaderCircle,
  MoreVertical,
  PackagePlus,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import {
  AdminButton,
  AdminField,
  AdminInput,
  AdminPageHeader,
  AdminTextarea,
} from "@/components/admin/AdminBits";
import {
  buildSupplierMessage,
  downloadInventoryCsv,
  normalizeWhatsAppPhone,
  printInventoryReport,
  suggestedPurchase,
  type InventoryItem,
  type StockList,
  type Supplier,
} from "@/lib/inventory";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/stock")({
  head: () => ({
    meta: [{ title: "Control de stock - Hotspot" }, { name: "robots", content: "noindex" }],
  }),
  component: StockPage,
});
type AdminData = {
  lists: StockList[];
  allItems: InventoryItem[];
  items: Array<InventoryItem & { list_id: string; sort_order: number }>;
  suppliers: Supplier[];
  supplierRelations: Array<{ stock_item_id: string; supplier_id: string; is_primary: boolean }>;
  counts: any[];
  orders: any[];
  assignments: Array<{ list_id: string; user_id: string }>;
  users: Array<{ id: string; email?: string; name: string; role: string | null }>;
};
const newItem = {
  id: "",
  name: "",
  quantity: 0,
  low_stock_threshold: 0,
  target_stock: "" as number | "",
  unit: "unidades",
  sku: "",
  allow_negative: false,
  available: true,
};
const newSupplier = {
  id: "",
  name: "",
  phone: "",
  address: "",
  business_hours: "",
  notes: "",
  active: true,
};
async function request(method: "GET" | "POST", payload?: any) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(
    method === "GET" ? "/api/admin/inventory?view=admin" : "/api/admin/inventory",
    {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: payload ? JSON.stringify(payload) : undefined,
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "No se pudo completar la accion.");
  return result;
}
const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">{children}</div>
);
const Modal = ({
  title,
  onClose,
  children,
  titleClassName = "",
  bodyClassName = "",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  titleClassName?: string;
  bodyClassName?: string;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm md:p-6"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onKeyDown={(event) => {
      if (event.key === "Escape") onClose();
    }}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h2 className={`text-xl font-bold ${titleClassName}`}>{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className={`min-w-0 overflow-y-auto p-5 ${bodyClassName}`}>{children}</div>
    </div>
  </div>
);
const Metric = ({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) => (
  <div
    className={`flex min-h-24 min-w-0 flex-col justify-center rounded-xl border p-3 sm:p-4 ${alert && value > 0 ? "border-orange-400/40 bg-orange-500/10" : "border-white/10 bg-zinc-900/70"}`}
  >
    <p className="max-w-full break-words text-[11px] font-medium uppercase leading-tight tracking-wide text-zinc-400 sm:text-xs">
      {label}
    </p>
    <p className="mt-1 text-2xl font-bold leading-none sm:text-3xl">{value}</p>
  </div>
);

function StockPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [tab, setTab] = useState("lists");
  const [loading, setLoading] = useState(true);
  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      setData(await request("GET"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const act = async (payload: any) => {
    try {
      await request("POST", payload);
      toast.success("Cambios guardados.");
      await load(false);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      return false;
    }
  };
  const activeItems = data?.allItems.filter((x) => x.available) ?? [];
  const low = activeItems.filter((x) => +x.quantity <= +x.low_stock_threshold).length;
  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-3">
        <AdminPageHeader
          eyebrow="Inventario manual"
          title="Stock"
          description="Gestioná tus listas e inventario"
        />
        <button
          type="button"
          onClick={() => load(false)}
          className="mt-1 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-300 transition hover:border-orange-400/40 hover:text-orange-300"
          aria-label="Actualizar stock"
          title="Actualizar"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <Metric label="Productos activos" value={activeItems.length} />
        <Metric label="Listas" value={data?.lists.filter((x) => x.active).length ?? 0} />
        <Metric label="Stock bajo" value={low} alert />
        <Metric
          label="Sin objetivo"
          value={activeItems.filter((x) => x.target_stock == null).length}
          alert={activeItems.some((x) => x.target_stock == null)}
        />
      </div>
      <div className="mb-5 flex items-center gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 rounded-xl border border-white/10 bg-zinc-900/70 p-1">
          {(
            [
              ["lists", "Listas", ListChecks],
              ["items", "Productos", PackagePlus],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${tab === key ? "bg-orange-500 text-black" : "text-zinc-300 hover:bg-white/5"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <details className="group relative shrink-0">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl border border-white/10 bg-zinc-900 px-3 text-sm font-semibold text-zinc-200 hover:border-orange-400/40 [&::-webkit-details-marker]:hidden">
            <MoreVertical className="h-5 w-5" />
            <span className="hidden sm:inline">Más opciones</span>
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl">
            {(
              [
                ["suppliers", "Proveedores", Truck],
                ["reports", "Reportes y pedidos", FileText],
                ["history", "Historial", ClipboardCheck],
                ["users", "Operadores", Users],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                onClick={(event) => {
                  setTab(key);
                  event.currentTarget.closest("details")?.removeAttribute("open");
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${tab === key ? "bg-orange-500 text-black" : "text-zinc-200 hover:bg-white/10"}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </details>
      </div>
      {loading ? (
        <Panel>Cargando inventario...</Panel>
      ) : data ? (
        <>
          {tab === "lists" && <Lists data={data} act={act} />}{" "}
          {tab === "items" && <Items data={data} act={act} />}{" "}
          {tab === "suppliers" && <Suppliers data={data} act={act} />}{" "}
          {tab === "reports" && <Reports data={data} act={act} />}{" "}
          {tab === "history" && <History data={data} />}{" "}
          {tab === "users" && <Operators data={data} act={act} />}
        </>
      ) : (
        <Panel>
          <div className="space-y-3 text-center">
            <p className="font-bold">No se pudo cargar el stock</p>
            <p className="text-sm text-zinc-400">Revisá tu conexión e intentá nuevamente.</p>
            <AdminButton onClick={() => load()}>Reintentar</AdminButton>
          </div>
        </Panel>
      )}
    </>
  );
}

function Lists({ data, act }: { data: AdminData; act: (p: any) => Promise<boolean> }) {
  const [form, setForm] = useState<any>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const deletedCount = data.lists.filter((list) => !list.active).length;
  const defaultStep = (unit: string) =>
    /^(kg|kilo|kilos|litro|litros|l)$/i.test(unit.trim()) ? 0.1 : 1;
  const edit = (list?: StockList) =>
    setForm(
      list
        ? {
            ...list,
            item_ids: data.items.filter((x) => x.list_id === list.id).map((x) => x.id),
            user_ids: data.assignments.filter((x) => x.list_id === list.id).map((x) => x.user_id),
            steps: Object.fromEntries(
              data.items.filter((x) => x.list_id === list.id).map((x) => [x.id, x.step ?? 1]),
            ),
          }
        : {
            name: "",
            slug: "",
            description: "",
            active: true,
            item_ids: [],
            user_ids: [],
            steps: {},
          },
    );
  const qr = async (list: StockList) => {
    const image = await QRCode.toDataURL(`${location.origin}/stock/${list.slug}`, {
      width: 640,
      margin: 2,
    });
    const a = document.createElement("a");
    a.href = image;
    a.download = `qr-${list.slug}.png`;
    a.click();
  };
  if (form)
    return (
      <Modal title={form.id ? "Editar lista" : "Nueva lista"} onClose={() => setForm(null)}>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          <AdminField label="Nombre">
            <AdminInput
              placeholder="Nombre de la lista"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                  slug: form.id ? form.slug : e.target.value,
                })
              }
            />
          </AdminField>
          <AdminField label="Descripción">
            <AdminInput
              placeholder="Descripción de uso"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </AdminField>
          <AdminField label="Enlace de la lista">
            <AdminInput
              placeholder="cocina-y-produccion"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </AdminField>
        </div>
        <h3 className="mb-2 mt-5 font-bold">Productos ({form.item_ids.length})</h3>
        <AdminInput
          className="mb-3 w-full md:w-80"
          placeholder="Buscar productos para la lista"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
        />
        <div className="grid gap-2 md:max-h-80 md:grid-cols-2 md:overflow-auto xl:grid-cols-3">
          {data.allItems
            .filter(
              (item) =>
                item.available && item.name.toLowerCase().includes(itemSearch.toLowerCase()),
            )
            .map((item) => (
              <label
                key={item.id}
                className="flex min-w-0 items-center gap-2 rounded border border-white/10 p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.item_ids.includes(item.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      item_ids: e.target.checked
                        ? [...form.item_ids, item.id]
                        : form.item_ids.filter((id: string) => id !== item.id),
                      steps: e.target.checked
                        ? {
                            ...form.steps,
                            [item.id]: form.steps[item.id] ?? defaultStep(item.unit),
                          }
                        : form.steps,
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block break-words">{item.name}</span>
                  {item.sku && <small className="block text-zinc-500">{item.sku}</small>}
                </span>
                {form.item_ids.includes(item.id) && (
                  <input
                    className="min-h-11 w-16 shrink-0 rounded border border-white/15 bg-black p-2"
                    type="number"
                    step=".001"
                    min=".001"
                    value={form.steps[item.id] ?? defaultStep(item.unit)}
                    onChange={(e) =>
                      setForm({ ...form, steps: { ...form.steps, [item.id]: +e.target.value } })
                    }
                  />
                )}
              </label>
            ))}
        </div>
        <h3 className="my-3 font-bold">Operadores</h3>
        {data.users
          .filter((x) => x.role === "operator")
          .map((user) => (
            <label
              key={user.id}
              className="mb-2 flex min-w-0 items-start gap-3 rounded border border-white/10 p-3"
            >
              <input
                type="checkbox"
                checked={form.user_ids.includes(user.id)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    user_ids: e.target.checked
                      ? [...form.user_ids, user.id]
                      : form.user_ids.filter((id: string) => id !== user.id),
                  })
                }
              />
              <span className="min-w-0">
                <strong className="block">{user.name}</strong>
                <span className="block break-all text-sm text-zinc-400">{user.email}</span>
              </span>
            </label>
          ))}
        <div className="sticky bottom-0 -mx-5 mt-5 border-t border-white/10 bg-zinc-950 px-5 py-4">
          <AdminButton
            className="w-full sm:w-auto"
            disabled={!form.name.trim() || !form.item_ids.length}
            onClick={async () => {
              if (await act({ action: "save_list", ...form })) setForm(null);
            }}
          >
            <Save className="h-4 w-4" />
            Guardar
          </AdminButton>
        </div>
      </Modal>
    );
  return (
    <div className="grid gap-3 pb-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <AdminInput
          className="w-full pl-10"
          placeholder="Buscar listas…"
          value={listSearch}
          onChange={(event) => setListSearch(event.target.value)}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <AdminButton className="shrink-0" onClick={() => edit()}>
          <Plus className="h-4 w-4" />
          Crear lista
        </AdminButton>
        {deletedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDeleted(!showDeleted)}
            className="min-h-11 px-2 text-sm font-semibold text-zinc-400 hover:text-orange-300"
          >
            {showDeleted ? "Ocultar eliminadas" : `Eliminadas (${deletedCount})`}
          </button>
        )}
      </div>
      {!data.lists.some((list) => list.active) && !listSearch && (
        <Panel>
          <div className="mx-auto max-w-md space-y-3 py-4 text-center">
            <h2 className="text-lg font-bold">Todavía no creaste ninguna lista</h2>
            <p className="text-sm text-zinc-400">
              Creá una lista para comenzar a organizar tu inventario.
            </p>
            <AdminButton onClick={() => edit()}>
              <Plus className="h-4 w-4" /> Crear primera lista
            </AdminButton>
          </div>
        </Panel>
      )}
      {listSearch &&
        !data.lists.some(
          (list) =>
            (showDeleted || list.active) &&
            list.name.toLowerCase().includes(listSearch.trim().toLowerCase()),
        ) && <Panel>No encontramos listas con esa búsqueda.</Panel>}
      {data.lists
        .filter(
          (list) =>
            (showDeleted || list.active) &&
            list.name.toLowerCase().includes(listSearch.trim().toLowerCase()),
        )
        .map((list) => (
          <article
            key={list.id}
            className={`rounded-xl border p-4 ${list.active ? "border-white/10 bg-zinc-900/70" : "border-red-400/20 bg-red-950/10"}`}
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h2 className="truncate font-bold">{list.name}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${list.active ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                  >
                    {list.active ? "Activa" : "Eliminada"}
                  </span>
                </div>
                <p className="text-sm text-zinc-400">
                  {list.item_count ?? 0} productos · {list.low_count ?? 0} con stock bajo
                </p>
                {(list.last_count_at || list.updated_at) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    Última actualización:{" "}
                    {new Date(list.last_count_at || list.updated_at!).toLocaleString("es-AR")}
                  </p>
                )}
              </div>
              <details className="relative shrink-0">
                <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
                  <MoreVertical className="h-5 w-5" />
                  <span className="sr-only">Acciones de {list.name}</span>
                </summary>
                <div className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => edit(list)}
                    className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-white/10"
                  >
                    Editar
                  </button>
                  {list.active && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la lista “${list.name}”?`)) {
                          act({ action: "archive_list", id: list.id });
                        }
                      }}
                      className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-red-300 hover:bg-red-500/10"
                    >
                      <span className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4" /> Eliminar
                      </span>
                    </button>
                  )}
                </div>
              </details>
            </div>
            {list.active && (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                <Link
                  to="/stock/$slug"
                  params={{ slug: list.slug }}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-bold hover:border-orange-400/40"
                >
                  Abrir
                </Link>
                <AdminButton variant="secondary" onClick={() => qr(list)}>
                  <QrCode className="h-4 w-4" /> QR
                </AdminButton>
              </div>
            )}
          </article>
        ))}
    </div>
  );
}

function Items({ data, act }: { data: AdminData; act: (p: any) => Promise<boolean> }) {
  const [form, setForm] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(25);
  const deletedCount = data.allItems.filter((x) => !x.available).length;
  const visible = data.allItems.filter(
    (x) => (showDeleted || x.available) && x.name.toLowerCase().includes(search.toLowerCase()),
  );
  useEffect(() => setVisibleLimit(25), [search, showDeleted]);
  return (
    <div className="grid gap-4">
      <div>
        <AdminButton onClick={() => setForm({ ...newItem })}>
          <Plus className="h-4 w-4" />
          Agregar item
        </AdminButton>
      </div>
      {form && (
        <Modal title={form.id ? "Editar item" : "Nuevo item"} onClose={() => setForm(null)}>
          <div className="grid gap-3 md:grid-cols-4">
            <AdminField label="Nombre">
              <AdminInput
                placeholder="Nombre del item"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </AdminField>
            <AdminField label="Unidad">
              <AdminInput
                placeholder="kg, litro, unidad"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </AdminField>
            <AdminField label="Código o SKU">
              <AdminInput
                placeholder="SKU"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </AdminField>
            <AdminField label="Cantidad actual">
              <AdminInput
                type="number"
                step=".001"
                placeholder="Cantidad"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: +e.target.value })}
              />
            </AdminField>
            <AdminField label="Stock mínimo">
              <AdminInput
                type="number"
                step=".001"
                placeholder="Minimo"
                value={form.low_stock_threshold}
                onChange={(e) => setForm({ ...form, low_stock_threshold: +e.target.value })}
              />
            </AdminField>
            <AdminField label="Stock objetivo">
              <AdminInput
                type="number"
                step=".001"
                placeholder="Objetivo"
                value={form.target_stock}
                onChange={(e) =>
                  setForm({ ...form, target_stock: e.target.value === "" ? "" : +e.target.value })
                }
              />
            </AdminField>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={form.allow_negative}
                onChange={(e) => setForm({ ...form, allow_negative: e.target.checked })}
              />
              Permitir negativos
            </label>
            <AdminButton
              disabled={!form.name.trim()}
              onClick={async () => {
                if (await act({ action: "save_item", ...form })) setForm(null);
              }}
            >
              <Save className="h-4 w-4" />
              Guardar
            </AdminButton>
          </div>
        </Modal>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <AdminInput
          className="min-w-64 flex-1"
          placeholder="Buscar productos"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {deletedCount > 0 && (
          <label className="inline-flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            Mostrar eliminados ({deletedCount})
          </label>
        )}
      </div>
      {visible.slice(0, visibleLimit).map((item) => (
        <div
          key={item.id}
          className={`grid grid-cols-3 gap-2 rounded border p-3 md:grid-cols-[1fr_110px_110px_120px_auto] md:items-center ${+item.quantity <= +item.low_stock_threshold ? "border-orange-400/40" : "border-white/10"}`}
        >
          <strong className="col-span-3 min-w-0 break-words md:col-span-1">{item.name}</strong>
          <span className="text-sm">
            {item.quantity} {item.unit}
          </span>
          <span className="text-sm">Min. {item.low_stock_threshold}</span>
          <span className="text-sm">
            {item.target_stock == null ? "Sin objetivo" : `Obj. ${item.target_stock}`}
          </span>
          <div className="col-span-3 flex flex-wrap gap-2 md:col-span-1">
            <AdminButton
              variant="secondary"
              onClick={() =>
                setForm({ ...item, target_stock: item.target_stock ?? "", sku: item.sku ?? "" })
              }
            >
              Editar
            </AdminButton>
            {item.available && (
              <AdminButton
                variant="danger"
                onClick={() => act({ action: "archive_item", id: item.id })}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </AdminButton>
            )}
            {!item.available && (
              <span className="inline-flex items-center rounded-md border border-zinc-600 px-3 py-2 text-sm text-zinc-400">
                Eliminado
              </span>
            )}
          </div>
        </div>
      ))}
      {visible.length > visibleLimit && (
        <AdminButton variant="secondary" onClick={() => setVisibleLimit(visibleLimit + 25)}>
          Mostrar 25 mas ({visible.length - visibleLimit} pendientes)
        </AdminButton>
      )}
    </div>
  );
}

function Suppliers({ data, act }: { data: AdminData; act: (p: any) => Promise<boolean> }) {
  const blank = { ...newSupplier, item_ids: [], primary_item_ids: [] };
  const [form, setForm] = useState<any>(null);
  const [productSearch, setProductSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [bulkAssignment, setBulkAssignment] = useState<{
    supplier_id: string;
    item_ids: string[];
    search: string;
  } | null>(null);
  const deletedCount = data.suppliers.filter((supplier) => !supplier.active).length;
  const assignedItemIds = new Set(data.supplierRelations.map((relation) => relation.stock_item_id));
  const closeEditor = () => {
    if (saving) return;
    setForm(null);
    setProductSearch("");
    setSaveError("");
  };
  const edit = (s: Supplier) => {
    const rel = data.supplierRelations.filter((r) => r.supplier_id === s.id);
    setForm({
      ...s,
      item_ids: [...new Set(rel.map((r) => r.stock_item_id))],
      primary_item_ids: [...new Set(rel.filter((r) => r.is_primary).map((r) => r.stock_item_id))],
    });
    setProductSearch("");
    setSaveError("");
  };
  const normalizedSearch = productSearch.trim().toLowerCase();
  const filteredItems = data.allItems.filter(
    (item) =>
      item.available &&
      (!normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        (item.sku ?? "").toLowerCase().includes(normalizedSearch)),
  );
  const saveSupplier = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form || saving || !form.name.trim()) return;
    setSaving(true);
    setSaveError("");
    const itemIds = [...new Set<string>(form.item_ids)];
    const primaryItemIds = [...new Set<string>(form.primary_item_ids)].filter((id) =>
      itemIds.includes(id),
    );
    const saved = await act({
      action: "save_supplier",
      ...form,
      item_ids: itemIds,
      primary_item_ids: primaryItemIds,
    });
    setSaving(false);
    if (saved) {
      setForm(null);
      setProductSearch("");
      setSaveError("");
    } else {
      setSaveError("No se pudieron guardar los cambios. Revisá los datos e intentá nuevamente.");
    }
  };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <AdminButton
          onClick={() => {
            setForm({ ...blank });
            setProductSearch("");
            setSaveError("");
          }}
        >
          <Plus className="h-4 w-4" />
          Agregar proveedor
        </AdminButton>
        <AdminButton
          variant="secondary"
          onClick={() => setBulkAssignment({ supplier_id: "", item_ids: [], search: "" })}
        >
          <Users className="h-4 w-4" />
          Asignación masiva
        </AdminButton>
        {deletedCount > 0 && (
          <AdminButton variant="secondary" onClick={() => setShowDeleted(!showDeleted)}>
            {showDeleted ? "Ocultar eliminados" : `Mostrar eliminados (${deletedCount})`}
          </AdminButton>
        )}
      </div>
      {bulkAssignment && (
        <Modal title="Asignación masiva" onClose={() => setBulkAssignment(null)}>
          <p className="mb-4 text-sm text-zinc-400">
            Seleccioná productos que todavía no tienen proveedor y asignales uno existente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="Proveedor">
              <select
                className="min-h-11 w-full rounded-md border border-white/10 bg-black px-3"
                value={bulkAssignment.supplier_id}
                onChange={(event) =>
                  setBulkAssignment({ ...bulkAssignment, supplier_id: event.target.value })
                }
              >
                <option value="">Seleccionar proveedor</option>
                {data.suppliers
                  .filter((supplier) => supplier.active)
                  .map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
              </select>
            </AdminField>
            <AdminField label="Buscar productos">
              <AdminInput
                type="search"
                placeholder="Nombre o código"
                value={bulkAssignment.search}
                onChange={(event) =>
                  setBulkAssignment({ ...bulkAssignment, search: event.target.value })
                }
              />
            </AdminField>
          </div>
          <div className="mt-4 max-h-[48vh] divide-y divide-white/10 overflow-y-auto rounded-lg border border-white/10">
            {data.allItems
              .filter(
                (item) =>
                  item.available &&
                  !assignedItemIds.has(item.id) &&
                  (!bulkAssignment.search.trim() ||
                    item.name.toLowerCase().includes(bulkAssignment.search.trim().toLowerCase()) ||
                    (item.sku ?? "")
                      .toLowerCase()
                      .includes(bulkAssignment.search.trim().toLowerCase())),
              )
              .map((item) => (
                <label key={item.id} className="flex min-h-12 items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={bulkAssignment.item_ids.includes(item.id)}
                    onChange={(event) =>
                      setBulkAssignment({
                        ...bulkAssignment,
                        item_ids: event.target.checked
                          ? [...bulkAssignment.item_ids, item.id]
                          : bulkAssignment.item_ids.filter((id) => id !== item.id),
                      })
                    }
                  />
                  <span className="min-w-0">
                    <strong className="block break-words">{item.name}</strong>
                    <small className="text-zinc-500">
                      {item.quantity} {item.unit}
                    </small>
                  </span>
                </label>
              ))}
            {!data.allItems.some((item) => item.available && !assignedItemIds.has(item.id)) && (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">
                Todos los productos activos ya tienen proveedor.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AdminButton variant="secondary" onClick={() => setBulkAssignment(null)}>
              Cancelar
            </AdminButton>
            <AdminButton
              disabled={!bulkAssignment.supplier_id || !bulkAssignment.item_ids.length}
              onClick={async () => {
                if (await act({ action: "bulk_assign_supplier", ...bulkAssignment })) {
                  setBulkAssignment(null);
                }
              }}
            >
              Asignar {bulkAssignment.item_ids.length || ""} productos
            </AdminButton>
          </div>
        </Modal>
      )}
      {form && (
        <Modal
          title={form.id ? "Editar proveedor" : "Nuevo proveedor"}
          onClose={closeEditor}
          titleClassName="font-display tracking-wide"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
        >
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveSupplier}>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              <section aria-labelledby="supplier-details-title">
                <h3 id="supplier-details-title" className="mb-3 text-sm font-bold text-zinc-100">
                  Información del proveedor
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminField label="Nombre o razón social">
                    <AdminInput
                      autoFocus
                      required
                      autoComplete="organization"
                      placeholder="Ej: Distribuidora Central"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Teléfono">
                    <AdminInput
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="Ej: 5492326123456"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Dirección">
                    <AdminInput
                      autoComplete="street-address"
                      placeholder="Calle, número y localidad"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                    />
                  </AdminField>
                  <AdminField label="Horario de atención">
                    <AdminInput
                      placeholder="Ej: Lunes a viernes de 8 a 17"
                      value={form.business_hours}
                      onChange={(e) => setForm({ ...form, business_hours: e.target.value })}
                    />
                  </AdminField>
                  <div className="md:col-span-2">
                    <AdminField label="Condiciones o notas de entrega">
                      <AdminTextarea
                        className="min-h-20 resize-y"
                        placeholder="Pedido mínimo, días de entrega u otras condiciones"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </AdminField>
                  </div>
                </div>
              </section>

              <section className="mt-6" aria-labelledby="supplier-products-title">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id="supplier-products-title" className="font-bold text-zinc-100">
                        Productos
                      </h3>
                      <span
                        className="rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-200"
                        aria-live="polite"
                      >
                        {form.item_ids.length} seleccionados
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      “Provee” vincula el producto. “Principal” define el proveedor preferido.
                    </p>
                  </div>
                  <AdminField label="Buscar productos">
                    <AdminInput
                      className="sm:w-80"
                      type="search"
                      placeholder="Nombre o código"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </AdminField>
                </div>

                <div
                  className="overflow-hidden rounded-lg border border-white/10 bg-black/20"
                  role="table"
                  aria-label="Productos asociados al proveedor"
                >
                  <div
                    className="hidden grid-cols-[minmax(0,1fr)_minmax(8rem,0.35fr)_6rem_7rem] gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-zinc-400 md:grid"
                    role="row"
                  >
                    <span role="columnheader">Producto</span>
                    <span role="columnheader">Código</span>
                    <span className="text-center" role="columnheader">
                      Provee
                    </span>
                    <span className="text-center" role="columnheader">
                      Principal
                    </span>
                  </div>
                  {filteredItems.length ? (
                    <div className="divide-y divide-white/10">
                      {filteredItems.map((item) => {
                        const provides = form.item_ids.includes(item.id);
                        const isPrimary = form.primary_item_ids.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className="grid gap-3 px-4 py-3 transition-colors hover:bg-white/[0.04] md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.35fr)_6rem_7rem] md:items-center"
                            role="row"
                          >
                            <div className="min-w-0" role="cell">
                              <strong className="block truncate text-sm text-white">
                                {item.name}
                              </strong>
                              <span className="mt-0.5 block text-xs text-zinc-500 md:hidden">
                                Código: {item.sku || "Sin código"}
                              </span>
                            </div>
                            <span
                              className="hidden truncate font-mono text-xs text-zinc-400 md:block"
                              role="cell"
                            >
                              {item.sku || "—"}
                            </span>
                            <div className="flex flex-wrap gap-2 md:contents" role="presentation">
                              <label
                                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-zinc-200 outline-none focus-within:ring-2 focus-within:ring-red-400 md:justify-center"
                                role="cell"
                              >
                                <input
                                  className="h-5 w-5 cursor-pointer accent-red-500"
                                  type="checkbox"
                                  checked={provides}
                                  aria-label={`Provee ${item.name}`}
                                  onChange={(e) =>
                                    setForm((current: any) => ({
                                      ...current,
                                      item_ids: e.target.checked
                                        ? current.item_ids.includes(item.id)
                                          ? current.item_ids
                                          : [...current.item_ids, item.id]
                                        : current.item_ids.filter((id: string) => id !== item.id),
                                      primary_item_ids: e.target.checked
                                        ? current.primary_item_ids
                                        : current.primary_item_ids.filter(
                                            (id: string) => id !== item.id,
                                          ),
                                    }))
                                  }
                                />
                                <span className="md:sr-only">Provee</span>
                              </label>
                              <label
                                className={`inline-flex min-h-10 items-center gap-2 rounded-md px-2 text-sm outline-none focus-within:ring-2 focus-within:ring-red-400 md:justify-center ${
                                  provides
                                    ? "cursor-pointer text-zinc-200"
                                    : "cursor-not-allowed text-zinc-600"
                                }`}
                                role="cell"
                              >
                                <input
                                  className="h-5 w-5 accent-red-500 disabled:cursor-not-allowed"
                                  type="checkbox"
                                  checked={isPrimary}
                                  disabled={!provides}
                                  aria-label={`Principal para ${item.name}`}
                                  onChange={(e) =>
                                    setForm((current: any) => ({
                                      ...current,
                                      item_ids: e.target.checked
                                        ? current.item_ids.includes(item.id)
                                          ? current.item_ids
                                          : [...current.item_ids, item.id]
                                        : current.item_ids,
                                      primary_item_ids: e.target.checked
                                        ? current.primary_item_ids.includes(item.id)
                                          ? current.primary_item_ids
                                          : [...current.primary_item_ids, item.id]
                                        : current.primary_item_ids.filter(
                                            (id: string) => id !== item.id,
                                          ),
                                    }))
                                  }
                                />
                                <span className="md:sr-only">Principal</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-5 py-10 text-center" role="row">
                      <p className="text-sm font-semibold text-zinc-200" role="cell">
                        No encontramos productos
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Probá con otro nombre o código, sin perder las selecciones actuales.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-white/10 bg-zinc-950 px-5 py-4 sm:flex-row sm:justify-end">
              {saveError && (
                <p className="mr-auto self-center text-sm text-red-300" role="alert">
                  {saveError}
                </p>
              )}
              <AdminButton
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={closeEditor}
              >
                Cancelar
              </AdminButton>
              <AdminButton type="submit" disabled={saving || !form.name.trim()}>
                {saving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                {saving ? "Guardando..." : "Guardar cambios"}
              </AdminButton>
            </footer>
          </form>
        </Modal>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {data.suppliers
          .filter((supplier) => showDeleted || supplier.active)
          .map((s) => (
            <Panel key={s.id}>
              <strong>{s.name}</strong>
              <p className="text-sm text-zinc-400">
                {s.phone || "Sin telefono"} ·{" "}
                {data.supplierRelations.filter((r) => r.supplier_id === s.id).length} productos
              </p>
              <div className="mt-3 flex gap-2">
                <AdminButton variant="secondary" onClick={() => edit(s)}>
                  Editar
                </AdminButton>
                {s.active && (
                  <AdminButton
                    variant="danger"
                    aria-label={`Eliminar proveedor ${s.name}`}
                    onClick={() => act({ action: "archive_supplier", id: s.id })}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </AdminButton>
                )}
              </div>
            </Panel>
          ))}
      </div>
    </div>
  );
}

function Reports({ data, act }: { data: AdminData; act: (p: any) => Promise<boolean> }) {
  const shortages = useMemo(
    () => data.allItems.filter((x) => x.available && +x.quantity <= +x.low_stock_threshold),
    [data],
  );
  const primary = (id: string) =>
    data.supplierRelations.find((r) => r.stock_item_id === id && r.is_primary)?.supplier_id ?? "";
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(shortages.map((x) => [x.id, suggestedPurchase(x) ?? 0])),
  );
  const [editedQty, setEditedQty] = useState<Record<string, boolean>>({});
  const [provider, setProvider] = useState<Record<string, string>>(() =>
    Object.fromEntries(shortages.map((x) => [x.id, primary(x.id)])),
  );
  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(shortages.map((x) => [x.id, true])),
  );
  const [supplierDraft, setSupplierDraft] = useState<{
    supplier: Supplier;
    items: InventoryItem[];
    quantities: Record<string, number>;
    included: Record<string, boolean>;
    search: string;
  } | null>(null);
  const [reportList, setReportList] = useState("");
  const [reportSupplier, setReportSupplier] = useState("");
  useEffect(() => {
    setQty((current) =>
      Object.fromEntries(
        shortages.map((x) => [
          x.id,
          editedQty[x.id] ? (current[x.id] ?? 0) : (suggestedPurchase(x) ?? 0),
        ]),
      ),
    );
    setProvider((current) =>
      Object.fromEntries(
        shortages.map((x) => [
          x.id,
          current[x.id] ||
            data.supplierRelations.find(
              (relation) => relation.stock_item_id === x.id && relation.is_primary,
            )?.supplier_id ||
            "",
        ]),
      ),
    );
    setIncluded((current) =>
      Object.fromEntries(shortages.map((x) => [x.id, current[x.id] ?? true])),
    );
  }, [shortages, data.supplierRelations, editedQty]);
  const activeOrderSupplierIds = new Set(
    data.orders
      .filter((order) => order.status === "draft" || order.status === "prepared")
      .map((order) => order.supplier_id),
  );
  const filteredReportItems = data.allItems.filter((item) => {
    if (!item.available) return false;
    if (
      reportList &&
      !data.items.some((link) => link.list_id === reportList && link.id === item.id)
    )
      return false;
    if (
      reportSupplier &&
      !data.supplierRelations.some(
        (relation) => relation.stock_item_id === item.id && relation.supplier_id === reportSupplier,
      )
    )
      return false;
    return true;
  });
  const rows = filteredReportItems.map((x) => [
    x.name,
    String(x.quantity),
    String(x.low_stock_threshold),
    x.target_stock == null ? "Sin configurar" : String(x.target_stock),
    String(qty[x.id] ?? 0),
    data.suppliers.find((s) => s.id === (provider[x.id] || primary(x.id)))?.name ?? "Sin proveedor",
  ]);
  const openSupplierDraft = (supplier: Supplier) => {
    const supplierItemIds = new Set(
      data.supplierRelations
        .filter((relation) => relation.supplier_id === supplier.id)
        .map((relation) => relation.stock_item_id),
    );
    const items = data.allItems.filter((item) => item.available && supplierItemIds.has(item.id));
    setSupplierDraft({
      supplier,
      items,
      quantities: Object.fromEntries(
        items.map((item) => [
          item.id,
          +item.quantity <= +item.low_stock_threshold ? (suggestedPurchase(item) ?? 0) : 0,
        ]),
      ),
      included: Object.fromEntries(
        items.map((item) => [
          item.id,
          +item.quantity <= +item.low_stock_threshold && (suggestedPurchase(item) ?? 0) > 0,
        ]),
      ),
      search: "",
    });
  };
  const createSupplierOrder = async () => {
    if (!supplierDraft) return;
    const items = supplierDraft.items
      .filter(
        (item) => supplierDraft.included[item.id] && (supplierDraft.quantities[item.id] ?? 0) > 0,
      )
      .map((x) => ({
        stock_item_id: x.id,
        item_name: x.name,
        unit: x.unit,
        current_quantity: x.quantity,
        target_stock: x.target_stock,
        suggested_quantity: suggestedPurchase(x) ?? 0,
        order_quantity: supplierDraft.quantities[x.id],
        included: true,
      }));
    if (!items.length)
      return toast.error("Seleccioná al menos un producto con cantidad mayor a cero.");
    const message = buildSupplierMessage(
      supplierDraft.supplier,
      items.map((x) => ({ name: x.item_name, quantity: x.order_quantity, unit: x.unit })),
    );
    const phone = normalizeWhatsAppPhone(supplierDraft.supplier.phone);
    const whatsappWindow = phone ? window.open("about:blank", "_blank") : null;
    if (
      await act({
        action: "create_order",
        supplier_id: supplierDraft.supplier.id,
        items,
      })
    ) {
      await navigator.clipboard.writeText(message).catch(() => undefined);
      if (phone && whatsappWindow) {
        whatsappWindow.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      } else if (phone) {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
      } else {
        whatsappWindow?.close();
        toast.info(
          "El proveedor no tiene un número de WhatsApp configurado. El mensaje fue copiado.",
        );
      }
      setSupplierDraft(null);
      toast.success(
        phone
          ? "Pedido creado. Revisá el mensaje y envialo desde WhatsApp."
          : "Pedido creado y mensaje copiado.",
      );
    } else {
      whatsappWindow?.close();
    }
  };
  const supplierDraftModal = supplierDraft ? (
    <Modal
      title={`Pedido a ${supplierDraft.supplier.name}`}
      onClose={() => setSupplierDraft(null)}
      bodyClassName="p-0"
    >
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-sm text-zinc-300">
          Los faltantes aparecen seleccionados. También podés agregar cualquier otro producto
          asociado a este proveedor.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Actual · mínimo · objetivo. Revisá las cantidades antes de abrir WhatsApp.
        </p>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <AdminInput
            className="pl-10"
            type="search"
            placeholder="Buscar productos del proveedor"
            value={supplierDraft.search}
            onChange={(event) => setSupplierDraft({ ...supplierDraft, search: event.target.value })}
          />
        </div>
      </div>
      <div className="divide-y divide-white/10">
        {supplierDraft.items
          .filter(
            (item) =>
              !supplierDraft.search.trim() ||
              item.name.toLowerCase().includes(supplierDraft.search.trim().toLowerCase()) ||
              (item.sku ?? "").toLowerCase().includes(supplierDraft.search.trim().toLowerCase()),
          )
          .map((item) => {
            const isLow = +item.quantity <= +item.low_stock_threshold;
            return (
              <div
                key={item.id}
                className={`grid gap-3 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_120px] sm:items-center ${supplierDraft.included[item.id] ? "bg-white/[0.025]" : "opacity-65"}`}
              >
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={supplierDraft.included[item.id] ?? false}
                    onChange={(event) =>
                      setSupplierDraft({
                        ...supplierDraft,
                        included: {
                          ...supplierDraft.included,
                          [item.id]: event.target.checked,
                        },
                      })
                    }
                  />
                  <span className="sm:hidden">Incluir</span>
                </label>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <strong className="break-words">{item.name}</strong>
                    {isLow && (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-bold text-orange-300">
                        Faltante
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    Actual {item.quantity} {item.unit} · Mínimo {item.low_stock_threshold} ·{" "}
                    {item.target_stock == null ? "Sin objetivo" : `Objetivo ${item.target_stock}`}
                  </p>
                </div>
                <AdminField label="Cantidad a pedir">
                  <AdminInput
                    type="number"
                    step=".001"
                    min="0"
                    value={supplierDraft.quantities[item.id] ?? 0}
                    onChange={(event) => {
                      const value = Math.max(0, +event.target.value);
                      setSupplierDraft({
                        ...supplierDraft,
                        quantities: { ...supplierDraft.quantities, [item.id]: value },
                        included: { ...supplierDraft.included, [item.id]: value > 0 },
                      });
                    }}
                  />
                </AdminField>
              </div>
            );
          })}
        {!supplierDraft.items.length && (
          <div className="px-5 py-10 text-center text-sm text-zinc-400">
            Este proveedor todavía no tiene productos asociados.
          </div>
        )}
      </div>
      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-white/10 bg-zinc-950 px-5 py-4 sm:flex-row sm:justify-end">
        <AdminButton variant="secondary" onClick={() => setSupplierDraft(null)}>
          Cancelar
        </AdminButton>
        <AdminButton onClick={createSupplierOrder} disabled={!supplierDraft.items.length}>
          <Send className="h-4 w-4" />
          {supplierDraft.supplier.phone ? "Crear y abrir WhatsApp" : "Crear y copiar mensaje"}
        </AdminButton>
      </div>
    </Modal>
  ) : null;
  return (
    <div className="grid gap-4">
      {supplierDraftModal}
      <section className="rounded-xl border border-white/10 bg-zinc-900/50 p-4">
        <h2 className="font-bold">Reportes de inventario</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Filtrá el contenido antes de descargarlo o imprimirlo.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <AdminField label="Lista">
            <select
              className="min-h-11 w-full rounded-md border border-white/10 bg-black px-3"
              value={reportList}
              onChange={(event) => setReportList(event.target.value)}
            >
              <option value="">Todas las listas</option>
              {data.lists
                .filter((list) => list.active)
                .map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
            </select>
          </AdminField>
          <AdminField label="Proveedor">
            <select
              className="min-h-11 w-full rounded-md border border-white/10 bg-black px-3"
              value={reportSupplier}
              onChange={(event) => setReportSupplier(event.target.value)}
            >
              <option value="">Todos los proveedores</option>
              {data.suppliers
                .filter((supplier) => supplier.active)
                .map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
            </select>
          </AdminField>
        </div>
      </section>
      <div className="flex flex-wrap gap-2">
        <AdminButton
          variant="secondary"
          onClick={() =>
            downloadInventoryCsv("stock-hotspot.csv", [
              ["Producto", "Actual", "Minimo", "Objetivo", "Pedido", "Proveedor"],
              ...rows,
            ])
          }
        >
          <Download className="h-4 w-4" />
          CSV
        </AdminButton>
        <AdminButton
          variant="secondary"
          onClick={() =>
            printInventoryReport(
              "Stock Hotspot",
              ["Producto", "Actual", "Minimo", "Objetivo", "Pedido", "Proveedor"],
              rows,
            )
          }
        >
          <FileText className="h-4 w-4" />
          PDF / Imprimir
        </AdminButton>
      </div>
      <Panel>
        <h2 className="mb-3 font-bold">Faltantes ({shortages.length})</h2>
        {shortages.map((item) => (
          <div
            key={item.id}
            className={`grid gap-2 border-b border-white/10 py-3 md:grid-cols-[auto_1fr_110px_180px] md:items-center ${included[item.id] ? "" : "opacity-50"}`}
          >
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={included[item.id] ?? true}
                onChange={(e) => setIncluded({ ...included, [item.id]: e.target.checked })}
              />
              Incluir
            </label>
            <div>
              <strong>{item.name}</strong>
              <p className="text-xs text-zinc-400">
                Actual {item.quantity} · Min {item.low_stock_threshold} ·{" "}
                {item.target_stock == null ? "Sin objetivo" : `Obj ${item.target_stock}`}
              </p>
            </div>
            <AdminInput
              type="number"
              step=".001"
              min="0"
              value={qty[item.id] ?? 0}
              onChange={(e) => {
                setEditedQty({ ...editedQty, [item.id]: true });
                setQty({ ...qty, [item.id]: +e.target.value });
              }}
            />
            <select
              className="min-h-11 min-w-0 rounded border border-white/10 bg-black p-2"
              value={provider[item.id] ?? ""}
              onChange={(e) => setProvider({ ...provider, [item.id]: e.target.value })}
            >
              <option value="">Sin proveedor</option>
              {data.suppliers
                .filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        ))}
      </Panel>
      <div className="border-t border-white/10 pt-5">
        <h2 className="font-bold">Pedidos por proveedor</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Prepará faltantes y productos adicionales para enviar por WhatsApp.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.suppliers
          .filter((supplier) => supplier.active)
          .map((s) => {
            const supplierItemIds = new Set(
              data.supplierRelations
                .filter((relation) => relation.supplier_id === s.id)
                .map((relation) => relation.stock_item_id),
            );
            const supplierItems = data.allItems.filter(
              (item) => item.available && supplierItemIds.has(item.id),
            );
            const supplierShortages = supplierItems.filter(
              (item) => +item.quantity <= +item.low_stock_threshold,
            );
            return (
              <Panel key={s.id}>
                <div className="flex h-full min-w-0 flex-col gap-3">
                  <div className="min-w-0 flex-1">
                    <strong className="break-words">{s.name}</strong>
                    <p className="mt-1 text-sm text-zinc-400">
                      {supplierShortages.length} faltantes · {supplierItems.length} productos
                      asociados
                    </p>
                    {!s.phone && (
                      <p className="mt-2 text-xs font-semibold text-amber-300">
                        Falta configurar el WhatsApp
                      </p>
                    )}
                  </div>
                  <AdminButton
                    className="w-full sm:w-auto"
                    disabled={activeOrderSupplierIds.has(s.id)}
                    onClick={() => openSupplierDraft(s)}
                  >
                    <Send className="h-4 w-4" />
                    {activeOrderSupplierIds.has(s.id) ? "Pedido pendiente" : "Generar pedido"}
                  </AdminButton>
                </div>
              </Panel>
            );
          })}
      </div>
      <div className="border-t border-white/10 pt-5">
        <h2 className="font-bold">Pedidos guardados</h2>
        <p className="mt-1 text-sm text-zinc-400">Historial y estado de los pedidos generados.</p>
      </div>
      {data.orders.map((order) => (
        <Panel key={order.id}>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-between">
            <div className="min-w-0">
              <strong>{order.suppliers?.name ?? "Sin proveedor"}</strong>
              <p className="text-sm text-zinc-400">
                {new Date(order.created_at).toLocaleString("es-AR")} ·{" "}
                {{
                  draft: "Borrador",
                  prepared: "Preparado",
                  ordered: "Pedido",
                  cancelled: "Cancelado",
                }[order.status as string] ?? order.status}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap gap-2">
              <AdminButton
                variant="secondary"
                onClick={() =>
                  downloadInventoryCsv(`pedido-${order.id.slice(0, 8)}.csv`, [
                    ["Producto", "Cantidad", "Unidad"],
                    ...order.purchase_order_items
                      .filter((x: any) => x.included)
                      .map((x: any) => [x.item_name, String(x.order_quantity), x.unit]),
                  ])
                }
              >
                <Download className="h-4 w-4" />
                CSV
              </AdminButton>
              <AdminButton
                variant="secondary"
                onClick={() =>
                  printInventoryReport(
                    `Pedido a ${order.suppliers?.name ?? "proveedor"}`,
                    ["Producto", "Cantidad", "Unidad"],
                    order.purchase_order_items
                      .filter((x: any) => x.included)
                      .map((x: any) => [x.item_name, String(x.order_quantity), x.unit]),
                  )
                }
              >
                <FileText className="h-4 w-4" />
                PDF
              </AdminButton>
              {order.suppliers?.phone && (
                <AdminButton
                  variant="secondary"
                  onClick={() => {
                    const msg = buildSupplierMessage(
                      { name: order.suppliers.name },
                      order.purchase_order_items
                        .filter((x: any) => x.included)
                        .map((x: any) => ({
                          name: x.item_name,
                          quantity: x.order_quantity,
                          unit: x.unit,
                        })),
                      order.notes,
                    );
                    window.open(
                      `https://wa.me/${normalizeWhatsAppPhone(order.suppliers.phone)}?text=${encodeURIComponent(msg)}`,
                      "_blank",
                    );
                    act({ action: "set_order_status", id: order.id, status: "prepared" });
                  }}
                >
                  <Send className="h-4 w-4" />
                  WhatsApp
                </AdminButton>
              )}
              <AdminButton
                onClick={() => act({ action: "set_order_status", id: order.id, status: "ordered" })}
              >
                Marcar pedido
              </AdminButton>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

function History({ data }: { data: AdminData }) {
  return (
    <div className="grid gap-3">
      {!data.counts.length && <Panel>Sin controles guardados.</Panel>}
      {data.counts.map((c) => (
        <Panel key={c.id}>
          <strong>{c.stock_lists?.name ?? "Lista"}</strong>
          <p className="text-sm text-zinc-400">
            {new Date(c.created_at).toLocaleString("es-AR")} ·{" "}
            {data.users.find((user) => user.id === c.operator_id)?.name ?? "Operador"}
          </p>
          {c.notes && <p>{c.notes}</p>}
          <div className="mt-3 grid gap-1 text-sm">
            {(c.stock_count_items ?? [])
              .filter((item: any) => Number(item.difference) !== 0)
              .map((item: any) => (
                <p key={item.id} className="break-words text-zinc-300">
                  {item.item_name}: {item.previous_quantity} → {item.counted_quantity} {item.unit}
                  <span
                    className={
                      Number(item.difference) < 0 ? "ml-2 text-red-300" : "ml-2 text-emerald-300"
                    }
                  >
                    ({Number(item.difference) > 0 ? "+" : ""}
                    {item.difference})
                  </span>
                </p>
              ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
function Operators({ data, act }: { data: AdminData; act: (p: any) => Promise<boolean> }) {
  const blank = { email: "", password: "", name: "" };
  const [form, setForm] = useState<typeof blank | null>(null);
  return (
    <div className="grid gap-4">
      <div>
        <AdminButton onClick={() => setForm({ ...blank })}>
          <Plus className="h-4 w-4" />
          Agregar operador
        </AdminButton>
      </div>
      {form && (
        <Modal title="Crear operador" onClose={() => setForm(null)}>
          <div className="grid gap-3 md:grid-cols-4">
            <AdminInput
              placeholder="Nombre"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <AdminInput
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <AdminInput
              type="password"
              placeholder="Contraseña temporal"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <AdminButton
              disabled={!form.email || form.password.length < 8}
              onClick={async () => {
                if (await act({ action: "create_operator", ...form })) setForm(null);
              }}
            >
              <Plus className="h-4 w-4" />
              Crear
            </AdminButton>
          </div>
        </Modal>
      )}
      {data.users
        .filter((u) => u.role)
        .map((u) => (
          <Panel key={u.id}>
            <strong>{u.name}</strong>
            <p className="text-sm text-zinc-300">{u.email}</p>
            <p className="text-sm text-zinc-400">
              {u.role === "owner" ? "Propietario" : "Operador"} ·{" "}
              {data.assignments.filter((x) => x.user_id === u.id).length} listas
            </p>
          </Panel>
        ))}
    </div>
  );
}
