import {
  documentSnapshotSchema,
  type DocumentMetadata,
  type DocumentSnapshot,
  type DomNode,
  type FormRecord,
  type LinkRecord,
  type TextBlock
} from "@bridgey/contracts";
import type { Page } from "playwright";

interface SnapshotExtraction {
  title: string;
  metadata: Omit<DocumentMetadata, "redirectedFrom">;
  dom: DomNode;
  links: LinkRecord[];
  forms: FormRecord[];
  textBlocks: TextBlock[];
}

interface SnapshotOptions {
  status: number | null;
  redirectedFrom?: string | null;
}

export async function captureDocumentSnapshot(
  page: Page,
  options: SnapshotOptions
): Promise<DocumentSnapshot> {
  const extraction = await page.evaluate((): SnapshotExtraction => {
    const MAX_NODES = 250;
    const MAX_DEPTH = 8;
    const MAX_CHILDREN = 20;
    const MAX_TEXT_BLOCKS = 100;
    const trackedAttributes = [
      "id",
      "class",
      "name",
      "type",
      "placeholder",
      "role",
      "href",
      "src",
      "action",
      "method",
      "value",
      "aria-label"
    ];
    let nodeCount = 0;

    const selectorFor = (element: Element): string => {
      if (element.id) {
        return `#${CSS.escape(element.id)}`;
      }

      const segments: string[] = [];
      let current: Element | null = element;

      while (current && segments.length < 3) {
        const tag = current.tagName.toLowerCase();
        const parent: Element | null = current.parentElement;
        const currentTagName = current.tagName;

        if (!parent) {
          segments.unshift(tag);
          break;
        }

        const siblings = Array.from(parent.children).filter(
          (child: Element) => child.tagName === currentTagName
        );
        const index = siblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-of-type(${index})`);
        current = parent;
      }

      return segments.join(" > ");
    };

    const collectAttributes = (element: Element): Record<string, string> => {
      const attributes: Record<string, string> = {};

      for (const attribute of trackedAttributes) {
        const value = element.getAttribute(attribute);

        if (value) {
          attributes[attribute] = value;
        }
      }

      return attributes;
    };

    const toDomNode = (element: Element, depth: number): DomNode => {
      nodeCount += 1;

      const tag = element.tagName.toLowerCase();
      const inputType = element.getAttribute("type");
      const clickable =
        element.matches("a,button,[role='button'],input[type='button'],input[type='submit']") ||
        Boolean(element.getAttribute("onclick"));
      const typeable = element.matches(
        "input:not([type='hidden']):not([type='button']):not([type='submit']),textarea"
      );
      const formControl = element.matches("input,textarea,select,button");

      const children =
        depth < MAX_DEPTH && nodeCount < MAX_NODES
          ? Array.from(element.children)
              .slice(0, MAX_CHILDREN)
              .map((child: Element) => toDomNode(child, depth + 1))
          : [];

      const text = element.textContent?.trim();

      return {
        id: selectorFor(element),
        tag,
        attributes: collectAttributes(element),
        text: text ? text.slice(0, 500) : null,
        interactiveHints: {
          clickable,
          typeable,
          formControl,
          role: element.getAttribute("role"),
          href: element.getAttribute("href"),
          inputType
        },
        children
      };
    };

    const rootElement = document.body ?? document.documentElement;
    const dom = toDomNode(rootElement, 0);
    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 100)
      .map((link) => ({
        text: link.textContent?.trim() ?? "",
        href: (link as HTMLAnchorElement).href,
        rel: link.getAttribute("rel"),
        target: link.getAttribute("target")
      }));
    const forms = Array.from(document.querySelectorAll("form"))
      .slice(0, 25)
      .map((form, index) => ({
        id: form.id || `form-${index + 1}`,
        action: form.getAttribute("action"),
        method: (form.getAttribute("method") || "get").toLowerCase(),
        fields: Array.from(form.querySelectorAll("input, textarea, select"))
          .slice(0, 30)
          .map((field) => ({
            name: field.getAttribute("name") || "",
            type: field.getAttribute("type") || field.tagName.toLowerCase(),
            selector: selectorFor(field),
            required: field.hasAttribute("required"),
            placeholder: field.getAttribute("placeholder")
          }))
      }));
    const textBlocks = Array.from(
      document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,article,section")
    )
      .map((element) => ({
        selector: selectorFor(element),
        text: element.textContent?.trim() ?? ""
      }))
      .filter((entry) => entry.text.length > 0)
      .slice(0, MAX_TEXT_BLOCKS);

    return {
      title: document.title,
      metadata: {
        description:
          document.querySelector("meta[name='description']")?.getAttribute("content") ?? null,
        lang: document.documentElement.lang || null,
        readyState: document.readyState,
        contentType: document.contentType || null
      },
      dom,
      links,
      forms,
      textBlocks
    };
  });

  return documentSnapshotSchema.parse({
    url: page.url(),
    title: extraction.title,
    status: options.status,
    metadata: {
      ...extraction.metadata,
      redirectedFrom: options.redirectedFrom ?? null
    },
    dom: extraction.dom,
    links: extraction.links,
    forms: extraction.forms,
    textBlocks: extraction.textBlocks,
    timestamp: new Date().toISOString()
  });
}
