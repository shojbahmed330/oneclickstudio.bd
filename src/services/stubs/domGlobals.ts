export const domGlobals = `
      declare class HTMLSelectElement extends HTMLElement { value: string; }
      declare class HTMLInputElement extends HTMLElement { value: string; checked: boolean; type: string; }
      declare class HTMLTextAreaElement extends HTMLElement { value: string; }
      declare class HTMLButtonElement extends HTMLElement { disabled: boolean; }
      declare class HTMLOptionElement extends HTMLElement { value: string; selected: boolean; }
      declare class HTMLFormElement extends HTMLElement { submit(): void; reset(): void; }
      declare class HTMLLabelElement extends HTMLElement { htmlFor: string; }
      declare class HTMLFieldSetElement extends HTMLElement { disabled: boolean; }
      declare class HTMLLegendElement extends HTMLElement {}
      declare class HTMLDataListElement extends HTMLElement { options: any; }
      declare class HTMLOutputElement extends HTMLElement { value: string; }
      declare class HTMLProgressElement extends HTMLElement { value: number; max: number; }
      declare class HTMLMeterElement extends HTMLElement { value: number; min: number; max: number; }
      declare class HTMLDivElement extends HTMLElement {}
      declare class HTMLSpanElement extends HTMLElement {}
      declare class HTMLParagraphElement extends HTMLElement {}
      declare class HTMLHeadingElement extends HTMLElement {}
      declare class HTMLPreElement extends HTMLElement {}
      declare class HTMLQuoteElement extends HTMLElement {}
      declare class HTMLHRElement extends HTMLElement {}
      declare class HTMLBRElement extends HTMLElement {}
      declare class HTMLImageElement extends HTMLElement { src: string; alt: string; }
      declare class HTMLVideoElement extends HTMLElement { src: string; play(): void; pause(): void; }
      declare class HTMLAudioElement extends HTMLElement { src: string; play(): void; pause(): void; }
      declare class HTMLSourceElement extends HTMLElement { src: string; type: string; }
      declare class HTMLTrackElement extends HTMLElement { src: string; kind: string; }
      declare class HTMLCanvasElement extends HTMLElement { getContext(id: string): any; }
      declare class HTMLPictureElement extends HTMLElement {}
      declare class HTMLAnchorElement extends HTMLElement { href: string; target: string; }
      declare class HTMLAreaElement extends HTMLElement { href: string; alt: string; }
      declare class HTMLMapElement extends HTMLElement { name: string; }
      declare class HTMLUListElement extends HTMLElement {}
      declare class HTMLOListElement extends HTMLElement {}
      declare class HTMLLIElement extends HTMLElement { value: number; }
      declare class HTMLDListElement extends HTMLElement {}
      declare class HTMLDTElement extends HTMLElement {}
      declare class HTMLDDElement extends HTMLElement {}
      declare class HTMLTableElement extends HTMLElement { rows: any; caption: any; }
      declare class HTMLTableRowElement extends HTMLElement { cells: any; rowIndex: number; }
      declare class HTMLTableCellElement extends HTMLElement { cellIndex: number; colSpan: number; rowSpan: number; }
      declare class HTMLTableSectionElement extends HTMLElement { rows: any; }
      declare class HTMLTableColElement extends HTMLElement { span: number; }
      declare class HTMLTableCaptionElement extends HTMLElement {}
      declare class HTMLMainElement extends HTMLElement {}
      declare class HTMLSectionElement extends HTMLElement {}
      declare class HTMLArticleElement extends HTMLElement {}
      declare class HTMLAsideElement extends HTMLElement {}
      declare class HTMLHeaderElement extends HTMLElement {}
      declare class HTMLFooterElement extends HTMLElement {}
      declare class HTMLNavElement extends HTMLElement {}
      declare class HTMLFigureElement extends HTMLElement {}
      declare class HTMLFigCaptionElement extends HTMLElement {}
      declare class HTMLTimeElement extends HTMLElement { dateTime: string; }
      declare class HTMLMarkElement extends HTMLElement {}
      declare class HTMLDetailsElement extends HTMLElement { open: boolean; }
      declare class HTMLSummaryElement extends HTMLElement {}
      declare class HTMLDialogElement extends HTMLElement { open: boolean; show(): void; showModal(): void; close(): void; }
      declare class HTMLMenuElement extends HTMLElement {}
      declare class HTMLScriptElement extends HTMLElement { src: string; type: string; async: boolean; }
      declare class HTMLStyleElement extends HTMLElement { type: string; media: string; }
      declare class HTMLLinkElement extends HTMLElement { href: string; rel: string; type: string; }
      declare class HTMLMetaElement extends HTMLElement { name: string; content: string; }
      declare class HTMLTitleElement extends HTMLElement { text: string; }
      declare class HTMLBaseElement extends HTMLElement { href: string; target: string; }
      declare class HTMLIFrameElement extends HTMLElement { src: string; name: string; }
      declare class HTMLEmbedElement extends HTMLElement { src: string; type: string; }
      declare class HTMLObjectElement extends HTMLElement { data: string; type: string; }
      declare class HTMLParamElement extends HTMLElement { name: string; value: string; }
      declare class HTMLTemplateElement extends HTMLElement { content: any; }
      declare class HTMLSlotElement extends HTMLElement { name: string; }
      declare class HTMLUnknownElement extends HTMLElement {}
      declare class HTMLElement { id: string; className: string; style: any; innerHTML: string; onclick: any; addEventListener(type: string, listener: any): void; }
      declare interface Window { 
        [key: string]: any; 
        localStorage: Storage; 
        sessionStorage: Storage; 
        location: Location; 
        history: History; 
        navigator: Navigator; 
        addEventListener(type: string, listener: any): void;
        removeEventListener(type: string, listener: any): void;
        dispatchEvent(event: Event): boolean;
      }
      declare interface ImportMeta {
        readonly env: {
          readonly [key: string]: string | boolean | undefined;
          readonly VITE_SUPABASE_URL: string;
          readonly VITE_SUPABASE_ANON_KEY: string;
        };
      }
      declare const importMeta: ImportMeta;
      declare interface Document { 
        getElementById(id: string): any; 
        body: HTMLElement; 
        createElement(tag: string): any; 
        querySelector(selector: string): any; 
        querySelectorAll(selector: string): any; 
        addEventListener(type: string, listener: any): void;
        removeEventListener(type: string, listener: any): void;
        dispatchEvent(event: Event): boolean;
      }
      declare interface Console {
        log(...args: any[]): void;
        info(...args: any[]): void;
        warn(...args: any[]): void;
        error(...args: any[]): void;
        debug(...args: any[]): void;
        trace(...args: any[]): void;
        assert(condition?: boolean, ...args: any[]): void;
        table(tabularData?: any, properties?: string[]): void;
        dir(item?: any, options?: any): void;
        dirxml(...data: any[]): void;
        group(...label: any[]): void;
        groupCollapsed(...label: any[]): void;
        groupEnd(): void;
        count(label?: string): void;
        countReset(label?: string): void;
        time(label?: string): void;
        timeLog(label?: string, ...data: any[]): void;
        timeEnd(label?: string): void;
        profile(reportName?: string): void;
        profileEnd(reportName?: string): void;
        clear(): void;
        timeStamp(label?: string): void;
        readonly memory: any;
        readonly context: any;
      }
`;
