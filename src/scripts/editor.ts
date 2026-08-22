import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";

interface PostData {
  id: number;
  body_md: string;
  cover_image: string | null;
}

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const data: PostData = JSON.parse(el("post-data").textContent ?? "{}");
const draftKey = `portfolio:draft:${data.id}`;

const shell = el("editor-shell");
const mount = el("editor-wysiwyg");
const source = el<HTMLTextAreaElement>("editor-source");
const statusLine = el("status-line");
const coverPreview = el<HTMLImageElement>("cover-preview");
const coverFile = el<HTMLInputElement>("cover-file");

let coverImage = data.cover_image;
let dirty = false;
let crepe: Crepe | undefined;

function setStatus(message: string): void {
  statusLine.textContent = message;
}

function markDirty(): void {
  dirty = true;
  // Cheap insurance against a closed tab. The server copy is still the one
  // that matters; this only survives long enough to be re-saved.
  try {
    localStorage.setItem(draftKey, currentMarkdown());
  } catch {
    // Private mode or a full quota -- not worth interrupting the writer for.
  }
}

function currentMarkdown(): string {
  if (shell.dataset.mode === "source") return source.value;
  return crepe?.getMarkdown() ?? source.value;
}

/**
 * Downscale and re-encode in the browser. This is what keeps `sharp` — and
 * with it 25 packages of prebuilt binaries — out of the server build.
 */
async function toWebp(file: File, maxWidth = 1920): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/webp",
      0.85,
    );
  });
}

async function uploadImage(file: File): Promise<string> {
  setStatus("Uploading…");
  const blob = await toWebp(file);
  const response = await fetch("/api/upload", {
    method: "POST",
    headers: { "content-type": blob.type },
    body: blob,
  });
  if (!response.ok) {
    setStatus("Upload failed");
    throw new Error(await response.text());
  }
  const { name } = (await response.json()) as { name: string };
  setStatus("Uploaded");
  return `/uploads/${name}`;
}

async function mountCrepe(markdown: string): Promise<void> {
  crepe = new Crepe({
    root: mount,
    defaultValue: markdown,
    featureConfigs: {
      [Crepe.Feature.ImageBlock]: {
        onUpload: uploadImage,
      },
    },
  });
  await crepe.create();
  crepe.on((listener) => {
    listener.markdownUpdated(() => markDirty());
  });
}

// --- source toggle ---------------------------------------------------
// Crepe has no setMarkdown, so switching back rebuilds it. The escape hatch
// only has to be correct, not fast.
el("toggle-source").addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;

  if (shell.dataset.mode === "wysiwyg") {
    source.value = crepe?.getMarkdown() ?? "";
    crepe?.destroy();
    crepe = undefined;
    shell.dataset.mode = "source";
    button.textContent = "Rich text";
    return;
  }

  const markdown = source.value;
  shell.dataset.mode = "wysiwyg";
  button.textContent = "Markdown";
  await mountCrepe(markdown);
});

source.addEventListener("input", markDirty);
for (const id of ["title", "slug", "excerpt", "status", "published-at"]) {
  el(id).addEventListener("input", markDirty);
}

// --- cover image -----------------------------------------------------

el("cover-pick").addEventListener("click", () => coverFile.click());

coverFile.addEventListener("change", async () => {
  const file = coverFile.files?.[0];
  if (!file) return;
  const url = await uploadImage(file);
  coverImage = url.replace("/uploads/", "");
  coverPreview.src = url;
  coverPreview.hidden = false;
  markDirty();
});

el("cover-clear").addEventListener("click", () => {
  coverImage = null;
  coverPreview.removeAttribute("src");
  coverPreview.hidden = true;
  markDirty();
});

// --- save / delete ---------------------------------------------------

el("save").addEventListener("click", async () => {
  setStatus("Saving…");
  const response = await fetch(`/api/posts/${data.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: el<HTMLInputElement>("title").value,
      slug: el<HTMLInputElement>("slug").value,
      excerpt: el<HTMLTextAreaElement>("excerpt").value,
      cover_image: coverImage,
      status: el<HTMLSelectElement>("status").value,
      published_at: el<HTMLInputElement>("published-at").value,
      body_md: currentMarkdown(),
    }),
  });

  if (!response.ok) {
    setStatus(`Save failed: ${await response.text()}`);
    return;
  }

  const saved = (await response.json()) as { slug: string };
  el<HTMLInputElement>("slug").value = saved.slug;
  dirty = false;
  localStorage.removeItem(draftKey);
  setStatus("Saved");
});

el("delete").addEventListener("click", async () => {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  const response = await fetch(`/api/posts/${data.id}`, { method: "DELETE" });
  if (!response.ok) {
    setStatus("Delete failed");
    return;
  }
  dirty = false;
  localStorage.removeItem(draftKey);
  location.href = "/admin";
});

addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
});

// --- boot ------------------------------------------------------------

const snapshot = localStorage.getItem(draftKey);
const initial =
  snapshot &&
  snapshot !== data.body_md &&
  confirm("Restore unsaved changes from this browser?")
    ? snapshot
    : data.body_md;

source.value = initial;
await mountCrepe(initial);
