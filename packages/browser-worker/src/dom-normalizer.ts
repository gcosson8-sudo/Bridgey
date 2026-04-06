import {
  documentSnapshotSchema,
  type DocumentMetadata,
  type DocumentRuntime,
  type DomNode,
  type DocumentSnapshot,
  type FormRecord,
  type LinkRecord,
  type RenderInfo,
  type ScriptAsset,
  type StylesheetAsset,
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
  runtime: DocumentRuntime;
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

    const roundLayoutValue = (value: number): number => Math.round(value * 100) / 100;

    const buildRenderInfo = (element: Element): RenderInfo => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      return {
        visible,
        layout: {
          x: roundLayoutValue(rect.left + window.scrollX),
          y: roundLayoutValue(rect.top + window.scrollY),
          width: roundLayoutValue(rect.width),
          height: roundLayoutValue(rect.height)
        },
        computedStyle: {
          display: style.display,
          visibility: style.visibility,
          position: style.position,
          color: style.color || null,
          backgroundColor: style.backgroundColor || null,
          fontSize: style.fontSize || null,
          fontWeight: style.fontWeight || null,
          textAlign: style.textAlign || null,
          opacity: style.opacity || null,
          zIndex: style.zIndex || null,
          overflowX: style.overflowX || null,
          overflowY: style.overflowY || null
        }
      };
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
        render: buildRenderInfo(element),
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
    const scripts: ScriptAsset[] = Array.from(document.scripts)
      .slice(0, 100)
      .map((script) => ({
        src: script.src || null,
        type: script.type || null,
        async: script.async,
        defer: script.defer,
        module: script.type === "module",
        inline: !script.src,
        textLength: script.textContent?.length ?? 0
      }));
    const stylesheets: StylesheetAsset[] = Array.from(document.styleSheets)
      .slice(0, 100)
      .map((sheet) => {
        const ownerNode = sheet.ownerNode;
        const ownerElement = ownerNode instanceof Element ? ownerNode : null;
        const href = "href" in sheet ? sheet.href : null;
        let ruleCount: number | null = null;

        try {
          ruleCount = sheet.cssRules.length;
        } catch {
          ruleCount = null;
        }

        return {
          href: href || null,
          media: ownerElement?.getAttribute("media") || null,
          disabled: "disabled" in sheet ? Boolean(sheet.disabled) : false,
          inline: !href,
          ruleCount
        };
      });

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
      textBlocks,
      runtime: {
        javascriptExecuted: true,
        stylesApplied: true,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          devicePixelRatio: window.devicePixelRatio || 1
        },
        scripts,
        stylesheets
      }
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
    runtime: extraction.runtime,
    timestamp: new Date().toISOString()
  });
}
