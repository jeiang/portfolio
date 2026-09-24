import { Crepe } from "@milkdown/crepe";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import { toDatetimeLocal } from "../lib/format.ts";

type PostStatus = "draft" | "published";

interface PostData {
  id: number;
  body_md: string;
  cover_image: string | null;
  status: PostStatus;
}

/** What PUT /api/posts/:id hands back: the fields the server may rewrite. */
interface SavedPost {
  slug: string;
  status: PostStatus;
  published_at: number | null;
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
const coverClear = el<HTMLButtonElement>("cover-clear");
const saveButton = el<HTMLButtonElement>("save");
const togglePublish = el<HTMLButtonElement>("toggle-publish");
const statusSelect = el<HTMLSelectElement>("status");
const slugInput = el<HTMLInputElement>("slug");
const publishedAt = el<HTMLInputElement>("published-at");
const publishedHint = el("published-hint");
const publishedSlug = el("published-slug");

let coverImage = data.cover_image;
/** The status the server holds, which is what the Publish/Unpublish button flips. */
let savedStatus = data.status;
let dirty = false;
/** Bumped on every edit, so a save can tell whether edits landed while it ran. */
let revision = 0;
/**
 * Crepe's serialisation of the saved body. Crepe rewrites markdown on load
 * (`- item` becomes `* item`, tables get re-padded), so body_md itself never
 * compares equal to what the editor reports and cannot be the baseline.
 */
let baseline = data.body_md;
let crepe: Crepe | undefined;

function setStatus(message: string, state?: "saving" | "saved" | "error"): void {
  statusLine.textContent = message;
  if (state) statusLine.dataset.state = state;
  else delete statusLine.dataset.state;
}

function markDirty(): void {
  dirty = true;
  revision += 1;
  // "Saved" is a lie once there is something new to save.
  if (statusLine.dataset.state === "saved") setStatus("");
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
    setStatus("Upload failed", "error");
    throw new Error(await response.text());
  }
  const { name } = (await response.json()) as { name: string };
  setStatus("Uploaded");
  return `/uploads/${name}`;
}

async function mountCrepe(markdown: string): Promise<void> {
  // Crepe defaults code blocks to oneDark but paints them on its light surface
  // colour, which leaves the tokens unreadable. Without a theme CodeMirror
  // falls back to its light base theme and basicSetup's default highlight
  // style. It has to be null: Crepe fills the config with lodash defaultsDeep,
  // which replaces undefined and merges oneDark into an empty array.
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  crepe = new Crepe({
    root: mount,
    defaultValue: markdown,
    featureConfigs: {
      [Crepe.Feature.CodeMirror]: dark ? {} : { theme: null as never },
      [Crepe.Feature.ImageBlock]: {
        onUpload: uploadImage,
      },
    },
  });
  await crepe.create();
  // With nothing unsaved, whatever Crepe makes of the body *is* the saved state.
  if (!dirty) baseline = crepe.getMarkdown();
  crepe.on((listener) => {
    // Crepe emits an update after load with no user edit; only a real change
    // against the baseline counts.
    listener.markdownUpdated((_ctx, updated) => {
      if (updated !== baseline) markDirty();
    });
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
  coverClear.hidden = false;
  markDirty();
});

coverClear.addEventListener("click", () => {
  coverImage = null;
  coverPreview.removeAttribute("src");
  coverPreview.hidden = true;
  coverClear.hidden = true;
  markDirty();
});

// --- save / delete ---------------------------------------------------

/** Reflect what the server stored, so the next save sends it back unchanged. */
function applySaved(saved: SavedPost): void {
  savedStatus = saved.status;
  slugInput.value = saved.slug;
  statusSelect.value = saved.status;
  // Without this the server's publish stamp never reaches the form, and the
  // next save sends an empty date and re-stamps the post as brand new.
  publishedAt.value = toDatetimeLocal(saved.published_at);
  publishedSlug.textContent = saved.slug;
  publishedHint.hidden = saved.status !== "published";
  togglePublish.textContent = saved.status === "published" ? "Unpublish" : "Publish";
}

async function save(status: PostStatus): Promise<void> {
  const sentRevision = revision;
  const body_md = currentMarkdown();
  saveButton.disabled = true;
  togglePublish.disabled = true;
  setStatus("Saving…", "saving");

  try {
    const response = await fetch(`/api/posts/${data.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: el<HTMLInputElement>("title").value,
        slug: slugInput.value,
        excerpt: el<HTMLTextAreaElement>("excerpt").value,
        cover_image: coverImage,
        status,
        published_at: publishedAt.value,
        body_md,
      }),
    });

    if (!response.ok) {
      setStatus(`Save failed: ${await response.text()}`, "error");
      return;
    }

    applySaved((await response.json()) as SavedPost);
    baseline = body_md;
    if (revision === sentRevision) {
      dirty = false;
      localStorage.removeItem(draftKey);
      setStatus("Saved", "saved");
    } else {
      setStatus("Saved; newer edits are not saved yet");
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    setStatus(`Save failed: ${reason}`, "error");
  } finally {
    saveButton.disabled = false;
    togglePublish.disabled = false;
  }
}

saveButton.addEventListener("click", () => {
  void save(statusSelect.value === "published" ? "published" : "draft");
});

togglePublish.addEventListener("click", () => {
  void save(savedStatus === "published" ? "draft" : "published");
});

el("delete").addEventListener("click", async () => {
  if (!confirm("Delete this post? This cannot be undone.")) return;
  const response = await fetch(`/api/posts/${data.id}`, { method: "DELETE" });
  if (!response.ok) {
    setStatus("Delete failed", "error");
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
// Mount the saved body first: the snapshot can only be compared against
// Crepe's normalised form of it, which does not exist until Crepe does.

source.value = data.body_md;
await mountCrepe(data.body_md);

const snapshot = localStorage.getItem(draftKey);
if (snapshot !== null) {
  if (
    snapshot !== baseline &&
    snapshot !== data.body_md &&
    confirm("Restore unsaved changes from this browser?")
  ) {
    // The restored text is unsaved by definition; keep the snapshot until a save.
    dirty = true;
    await crepe?.destroy();
    source.value = snapshot;
    await mountCrepe(snapshot);
  } else {
    localStorage.removeItem(draftKey);
  }
}
