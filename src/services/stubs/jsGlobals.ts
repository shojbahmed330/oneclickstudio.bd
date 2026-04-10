export const jsGlobals = `
      // --- JavaScript Globals ---
      declare const window: Window & typeof globalThis;
      declare const self: Window & typeof globalThis;
      declare const globalThis: typeof window;
      declare const document: Document;
      declare const console: Console;
      declare const alert: (message?: any) => void;
      declare const parseFloat: (string: string) => number;
      declare const parseInt: (string: string, radix?: number) => number;
      declare const setTimeout: (handler: any, timeout?: number, ...args: any[]) => number;
      declare const setInterval: (handler: any, timeout?: number, ...args: any[]) => number;
      declare const clearTimeout: (handle?: number) => void;
      declare const clearInterval: (handle?: number) => void;
      declare const requestAnimationFrame: (callback: (time: number) => void) => number;
      declare const cancelAnimationFrame: (handle: number) => void;
      declare const fetch: (input: any, init?: any) => Promise<any>;
      declare const localStorage: Storage;
      declare const sessionStorage: Storage;
      declare const location: Location;
      declare const history: History;
      declare const navigator: Navigator;
      declare const screen: any;
      declare const visualViewport: any;
      declare const crypto: any;
      declare const performance: any;
      declare const atob: (data: string) => string;
      declare const btoa: (data: string) => string;
      
      declare class TextEncoder { encode(input?: string): Uint8Array; readonly encoding: string; }
      declare class TextDecoder { decode(input?: any, options?: any): string; readonly encoding: string; }
      declare class URL { constructor(url: string, base?: string | URL); href: string; pathname: string; search: string; searchParams: URLSearchParams; }
      declare class URLSearchParams { constructor(init?: any); append(name: string, value: string): void; get(name: string): string | null; getAll(name: string): string[]; has(name: string): boolean; set(name: string, value: string): void; }
      declare class XMLHttpRequest { open(method: string, url: string): void; send(body?: any): void; onload: any; onerror: any; responseText: string; status: number; }
      declare class WebSocket { constructor(url: string); send(data: any): void; close(): void; onopen: any; onmessage: any; onclose: any; onerror: any; }
      declare class Worker { constructor(scriptURL: string); postMessage(message: any): void; terminate(): void; onmessage: any; onerror: any; }
      declare class File extends Blob { constructor(parts: any[], filename: string, options?: any); name: string; lastModified: number; }
      declare class Blob { constructor(parts?: any[], options?: any); size: number; type: string; slice(start?: number, end?: number): Blob; }
      declare class FileReader { readAsDataURL(blob: Blob): void; readAsText(blob: Blob): void; onload: any; result: any; }
      declare class Audio { constructor(src?: string); play(): Promise<void>; pause(): void; }
      declare class Video { constructor(src?: string); play(): Promise<void>; pause(): void; }
      declare class Event { constructor(type: string, eventInitDict?: any); type: string; target: EventTarget; }
      declare class Node { parentNode: Node; childNodes: any; appendChild(node: Node): Node; removeChild(node: Node): Node; }
      declare class Element extends Node { id: string; className: string; innerHTML: string; querySelector(selector: string): any; }
      declare class HTMLElement extends Element { style: any; onclick: any; }
      declare class HTMLDivElement extends HTMLElement {}
      declare class HTMLInputElement extends HTMLElement { value: string; }
      declare class HTMLButtonElement extends HTMLElement { disabled: boolean; }
      declare class HTMLFormElement extends HTMLElement { submit(): void; }

      declare interface Storage {
        readonly length: number;
        clear(): void;
        getItem(key: string): string | null;
        key(index: number): string | null;
        removeItem(key: string): void;
        setItem(key: string, value: string): void;
        [name: string]: any;
      }

      declare interface Location {
        href: string;
        pathname: string;
        search: string;
        hash: string;
        host: string;
        hostname: string;
        port: string;
        protocol: string;
        origin: string;
        assign(url: string): void;
        reload(): void;
        replace(url: string): void;
      }

      declare interface History {
        readonly length: number;
        scrollRestoration: 'auto' | 'manual';
        readonly state: any;
        back(): void;
        forward(): void;
        go(delta?: number): void;
        pushState(data: any, unused: string, url?: string | null): void;
        replaceState(data: any, unused: string, url?: string | null): void;
      }

      declare interface Navigator {
        readonly userAgent: string;
        readonly language: string;
        readonly languages: readonly string[];
        readonly onLine: boolean;
        clipboard: {
          readText(): Promise<string>;
          writeText(text: string): Promise<void>;
        };
        mediaDevices: any;
      }
      
      declare class Error { constructor(message?: string); message: string; name: string; }
      
      declare interface ConcatArray<T> { readonly length: number; readonly [n: number]: T; join(separator?: string): string; slice(start?: number, end?: number): T[]; }

      declare interface Array<T> { 
        length: number; 
        at(index: number): T | undefined;
        concat(...items: (T | ConcatArray<T>)[]): T[];
        copyWithin(target: number, start: number, end?: number): this;
        entries(): IterableIterator<[number, T]>;
        every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
        fill(value: T, start?: number, end?: number): this;
        filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[];
        find(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
        findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number;
        findLast(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): T | undefined;
        findLastIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number;
        flat<A, D extends number = 1>(this: A, depth?: D): any[];
        flatMap<U, This = undefined>(callback: (this: This, value: T, index: number, array: T[]) => U | ReadonlyArray<U>, thisArg?: This): U[];
        forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void;
        includes(searchElement: T, fromIndex?: number): boolean;
        indexOf(searchElement: T, fromIndex?: number): number;
        join(separator?: string): string;
        keys(): IterableIterator<number>;
        lastIndexOf(searchElement: T, fromIndex?: number): number;
        map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[];
        pop(): T | undefined;
        push(...items: T[]): number;
        reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
        reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
        reduceRight(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
        reduceRight<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
        reverse(): T[];
        shift(): T | undefined;
        slice(start?: number, end?: number): T[];
        some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean;
        sort(compareFn?: (a: T, b: T) => number): this;
        splice(start: number, deleteCount?: number, ...items: T[]): T[];
        toLocaleString(): string;
        toString(): string;
        unshift(...items: T[]): number;
        values(): IterableIterator<T>;
        [Symbol.iterator](): IterableIterator<T>;
      }

      declare interface String { 
        toString(): string;
        charAt(pos: number): string;
        charCodeAt(index: number): number;
        at(index: number): string | undefined;
        concat(...strings: string[]): string;
        includes(searchString: string, position?: number): boolean;
        startsWith(searchString: string, position?: number): boolean;
        endsWith(searchString: string, endPosition?: number): boolean;
        indexOf(searchString: string, position?: number): number;
        lastIndexOf(searchString: string, position?: number): number;
        match(regexp: string | RegExp): RegExpMatchArray | null;
        matchAll(regexp: RegExp): IterableIterator<RegExpMatchArray>;
        replace(searchValue: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)): string;
        replaceAll(searchValue: string | RegExp, replaceValue: string | ((substring: string, ...args: any[]) => string)): string;
        search(regexp: string | RegExp): number;
        slice(start?: number, end?: number): string;
        substring(start: number, end?: number): string;
        split(separator: string | RegExp, limit?: number): string[];
        toLowerCase(): string;
        toUpperCase(): string;
        trim(): string;
        trimStart(): string;
        trimEnd(): string;
        padStart(maxLength: number, fillString?: string): string;
        padEnd(maxLength: number, fillString?: string): string;
        repeat(count: number): string;
        localeCompare(that: string): number;
        normalize(form?: string): string;
        length: number;
        [Symbol.iterator](): IterableIterator<string>;
      }

      declare interface Number {
        toString(radix?: number): string;
        toFixed(fractionDigits?: number): string;
        toExponential(fractionDigits?: number): string;
        toPrecision(precision?: number): string;
        valueOf(): number;
      }

      declare interface NumberConstructor {
        isNaN(number: unknown): boolean;
        isFinite(number: unknown): boolean;
        isInteger(number: unknown): boolean;
        parseInt(string: string, radix?: number): number;
        parseFloat(string: string): number;
        readonly MAX_VALUE: number;
        readonly MIN_VALUE: number;
      }
      declare const Number: NumberConstructor;

      declare interface Boolean {
        toString(): string;
        valueOf(): boolean;
      }

      declare interface ObjectConstructor {
        keys(o: object): string[];
        values<T>(o: { [s: string]: T } | ArrayLike<T>): T[];
        entries<T>(o: { [s: string]: T } | ArrayLike<T>): [string, T][];
        assign<T, U>(target: T, source: U): T & U;
        freeze<T>(a: T[]): readonly T[];
        freeze<T extends Function>(f: T): T;
        freeze<T>(o: T): Readonly<T>;
        seal<T>(o: T): T;
        create(o: object | null): any;
        fromEntries<T = any>(entries: Iterable<readonly [any, T]>): { [k: string]: T };
        hasOwn(o: object, v: PropertyKey): boolean;
        getPrototypeOf(o: any): any;
        setPrototypeOf(o: any, proto: object | null): any;
        defineProperty(o: any, p: PropertyKey, attributes: PropertyDescriptor & ThisType<any>): any;
        defineProperties(o: any, properties: PropertyDescriptorMap & ThisType<any>): any;
      }
      declare const Object: ObjectConstructor;

      declare interface Math {
        abs(x: number): number;
        ceil(x: number): number;
        floor(x: number): number;
        round(x: number): number;
        max(...values: number[]): number;
        min(...values: number[]): number;
        random(): number;
        pow(x: number, y: number): number;
        sqrt(x: number): number;
        log(x: number): number;
        sin(x: number): number;
        cos(x: number): number;
        tan(x: number): number;
        trunc(x: number): number;
        sign(x: number): number;
        readonly PI: number;
        readonly E: number;
      }
      declare const Math: Math;

      declare interface Date {
        getDate(): number;
        getDay(): number;
        getFullYear(): number;
        getHours(): number;
        getMinutes(): number;
        getSeconds(): number;
        getMilliseconds(): number;
        getTime(): number;
        setDate(date: number): number;
        setFullYear(year: number, month?: number, date?: number): number;
        setHours(hours: number, min?: number, sec?: number, ms?: number): number;
        setMinutes(min: number, sec?: number, ms?: number): number;
        setSeconds(sec: number, ms?: number): number;
        toISOString(): string;
        toLocaleString(): string;
        toDateString(): string;
        toTimeString(): string;
      }
      declare interface DateConstructor {
        new(): Date;
        new(value: number | string): Date;
        now(): number;
        parse(s: string): number;
      }
      declare const Date: DateConstructor;

      declare interface JSON {
        parse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
        stringify(value: any, replacer?: (this: any, key: string, value: any) => any, space?: string | number): string;
      }
      declare const JSON: JSON;

      declare interface Promise<T> {
        then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): Promise<TResult1 | TResult2>;
        catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): Promise<T | TResult>;
        finally(onfinally?: (() => void) | undefined | null): Promise<T>;
      }
      declare interface PromiseConstructor {
        resolve<T>(value: T | PromiseLike<T>): Promise<T>;
        reject<T = never>(reason?: any): Promise<T>;
        all<T>(values: Iterable<T | PromiseLike<T>>): Promise<T[]>;
        allSettled<T>(values: Iterable<T | PromiseLike<T>>): Promise<any[]>;
        race<T>(values: Iterable<T | PromiseLike<T>>): Promise<T>;
        any<T>(values: Iterable<T | PromiseLike<T>>): Promise<T>;
      }
      declare const Promise: PromiseConstructor;

      declare interface Map<K, V> {
        clear(): void;
        delete(key: K): boolean;
        forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void, thisArg?: any): void;
        get(key: K): V | undefined;
        has(key: K): boolean;
        set(key: K, value: V): this;
        readonly size: number;
      }
      declare interface MapConstructor {
        new <K = any, V = any>(entries?: readonly (readonly [K, V])[] | null): Map<K, V>;
      }
      declare const Map: MapConstructor;

      declare interface Set<T> {
        add(value: T): this;
        clear(): void;
        delete(value: T): boolean;
        forEach(callbackfn: (value: T, value2: T, set: Set<T>) => void, thisArg?: any): void;
        has(value: T): boolean;
        readonly size: number;
      }
      declare interface SetConstructor {
        new <T = any>(values?: readonly T[] | null): Set<T>;
      }
      declare const Set: SetConstructor;

      declare function parseInt(string: string, radix?: number): number;
      declare function parseFloat(string: string): number;
      declare function isNaN(number: number): boolean;
      declare function isFinite(number: number): boolean;
      declare function encodeURI(uri: string): string;
      declare function decodeURI(encodedURI: string): string;
      declare function encodeURIComponent(uriComponent: string): string;
      declare function decodeURIComponent(encodedURIComponent: string): string;

      declare interface Function {
        apply(this: Function, thisArg: any, argArray?: any): any;
        call(this: Function, thisArg: any, ...argArray: any[]): any;
        bind(this: Function, thisArg: any, ...argArray: any[]): any;
        toString(): string;
      }

      declare interface RegExp {
        test(string: string): boolean;
        exec(string: string): RegExpExecArray | null;
        readonly source: string;
        readonly flags: string;
        readonly global: boolean;
        readonly ignoreCase: boolean;
        readonly multiline: boolean;
      }
      declare interface RegExpExecArray extends Array<string> { index: number; input: string; }
      declare interface RegExpMatchArray extends Array<string> { index?: number; input?: string; }

      declare interface IterableIterator<T> extends Iterator<T> { [Symbol.iterator](): IterableIterator<T>; }
      declare interface Iterator<T> { next(value?: any): IteratorResult<T>; }
      declare type IteratorResult<T> = { done: boolean; value: T; };
      declare interface SymbolConstructor { readonly iterator: unique symbol; }
      declare const Symbol: SymbolConstructor;
`;
