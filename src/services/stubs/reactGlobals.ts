export const reactGlobals = `
      // --- React & JSX ---
      declare namespace React {
        export type FC<P = {}> = (props: P) => any;
        export type ReactNode = any;
        export type ReactElement = any;
        export type ComponentType<P = {}> = any;
        export type CSSProperties = any;

        export interface SyntheticEvent<T = Element, E = Event> {
          bubbles: boolean;
          cancelable: boolean;
          currentTarget: T;
          defaultPrevented: boolean;
          eventPhase: number;
          isTrusted: boolean;
          nativeEvent: E;
          preventDefault(): void;
          isDefaultPrevented(): boolean;
          stopPropagation(): void;
          isPropagationStopped(): boolean;
          target: EventTarget;
          timeStamp: number;
          type: string;
        }

        export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
          target: EventTarget & T;
        }

        export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
        export interface InvalidEvent<T = Element> extends SyntheticEvent<T> {}
        
        export interface MouseEvent<T = Element, E = NativeMouseEvent> extends SyntheticEvent<T, E> {
          altKey: boolean;
          button: number;
          buttons: number;
          clientX: number;
          clientY: number;
          ctrlKey: boolean;
          metaKey: boolean;
          pageX: number;
          pageY: number;
          screenX: number;
          screenY: number;
          shiftKey: boolean;
        }
        
        export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, NativeKeyboardEvent> {
          altKey: boolean;
          charCode: number;
          ctrlKey: boolean;
          key: string;
          keyCode: number;
          locale: string;
          location: number;
          metaKey: boolean;
          repeat: boolean;
          shiftKey: boolean;
          which: number;
        }

        export interface FocusEvent<T = Element> extends SyntheticEvent<T, NativeFocusEvent> {
          relatedTarget: EventTarget | null;
        }

        export interface ClipboardEvent<T = Element> extends SyntheticEvent<T, NativeClipboardEvent> {
          clipboardData: any;
        }

        export interface PointerEvent<T = Element> extends MouseEvent<T, NativePointerEvent> {
          pointerId: number;
          pressure: number;
          pointerType: string;
        }

        export interface TouchEvent<T = Element> extends SyntheticEvent<T, NativeTouchEvent> {
          altKey: boolean;
          ctrlKey: boolean;
          metaKey: boolean;
          shiftKey: boolean;
          touches: any;
          targetTouches: any;
          changedTouches: any;
        }

        export interface DragEvent<T = Element> extends MouseEvent<T, NativeDragEvent> {
          dataTransfer: any;
        }

        export interface WheelEvent<T = Element> extends MouseEvent<T, NativeWheelEvent> {
          deltaMode: number;
          deltaX: number;
          deltaY: number;
          deltaZ: number;
        }

        export interface UIEvent<T = Element> extends SyntheticEvent<T, NativeUIEvent> {
          detail: number;
          view: any;
        }

        export interface AnimationEvent<T = Element> extends SyntheticEvent<T, NativeAnimationEvent> {
          animationName: string;
          elapsedTime: number;
          pseudoElement: string;
        }

        export interface TransitionEvent<T = Element> extends SyntheticEvent<T, NativeTransitionEvent> {
          propertyName: string;
          elapsedTime: number;
          pseudoElement: string;
        }

        export interface CompositionEvent<T = Element> extends SyntheticEvent<T, NativeCompositionEvent> {
          data: string;
        }

        export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
        export function useContext<T>(context: any): T;
        export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
        export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
        export function useRef<T>(initialValue: T): { current: T };
        export function useReducer<R extends (state: any, action: any) => any>(reducer: R, initialState: any): [any, any];
        export function createContext<T>(defaultValue: T): any;
        export const StrictMode: any;
        export const Suspense: any;
        export const Fragment: any;
      }

      declare interface NativeMouseEvent extends Event {}
      declare interface NativeKeyboardEvent extends Event {}
      declare interface NativeFocusEvent extends Event {}
      declare interface NativeClipboardEvent extends Event {}
      declare interface NativePointerEvent extends Event {}
      declare interface NativeTouchEvent extends Event {}
      declare interface NativeDragEvent extends Event {}
      declare interface NativeWheelEvent extends Event {}
      declare interface NativeUIEvent extends Event {}
      declare interface NativeAnimationEvent extends Event {}
      declare interface NativeTransitionEvent extends Event {}
      declare interface NativeCompositionEvent extends Event {}
      declare interface EventTarget {}

      declare module 'react' {
        export = React;
      }

      // --- Global Enforcement ---
      // This allows using hooks and event types without explicit imports
      declare global {
        const useState: typeof React.useState;
        const useEffect: typeof React.useEffect;
        const useContext: typeof React.useContext;
        const useMemo: typeof React.useMemo;
        const useCallback: typeof React.useCallback;
        const useRef: typeof React.useRef;
        const useReducer: typeof React.useReducer;
        
        type ChangeEvent<T = Element> = React.ChangeEvent<T>;
        type FormEvent<T = Element> = React.FormEvent<T>;
        type InvalidEvent<T = Element> = React.InvalidEvent<T>;
        type MouseEvent<T = Element> = React.MouseEvent<T>;
        type KeyboardEvent<T = Element> = React.KeyboardEvent<T>;
        type FocusEvent<T = Element> = React.FocusEvent<T>;
        type ClipboardEvent<T = Element> = React.ClipboardEvent<T>;
        type PointerEvent<T = Element> = React.PointerEvent<T>;
        type TouchEvent<T = Element> = React.TouchEvent<T>;
        type DragEvent<T = Element> = React.DragEvent<T>;
        type WheelEvent<T = Element> = React.WheelEvent<T>;
        type UIEvent<T = Element> = React.UIEvent<T>;
        type AnimationEvent<T = Element> = React.AnimationEvent<T>;
        type TransitionEvent<T = Element> = React.TransitionEvent<T>;
        type CompositionEvent<T = Element> = React.CompositionEvent<T>;
        type SyntheticEvent<T = Element> = React.SyntheticEvent<T>;

        type FC<P = {}> = React.FC<P>;
        type ReactNode = React.ReactNode;
        type ReactElement = React.ReactElement;
        type CSSProperties = React.CSSProperties;

        type DefaultElements =
          | HTMLInputElement
          | HTMLButtonElement
          | HTMLSelectElement
          | HTMLTextAreaElement
          | HTMLFormElement;
      }

      declare module 'react/jsx-runtime' {
        export const jsx: any;
        export const jsxs: any;
        export const Fragment: any;
      }

      declare module 'react-dom/client' {
        export function createRoot(container: any): any;
      }

      // --- Testing Globals ---
      declare function describe(name: string, fn: () => void): void;
      declare function test(name: string, fn: () => void | Promise<void>): void;
      declare function it(name: string, fn: () => void | Promise<void>): void;
      declare function beforeEach(fn: () => void | Promise<void>): void;
      declare function afterEach(fn: () => void | Promise<void>): void;
      declare function expect(actual: any): any;

      // --- Other Modules ---
      declare module 'react-router-dom' {
        export function useNavigate(): (to: string, options?: any) => void;
        export function useLocation(): any;
        export function useParams<K extends string = string>(): Readonly<Record<K, string | undefined>>;
        export const BrowserRouter: any;
        export const Routes: any;
        export const Route: any;
        export const Link: any;
        export const NavLink: any;
        export const Outlet: any;
        export const Navigate: any;
      }
      declare module 'lucide-react';
      declare module 'recharts';
      declare module 'motion/react';
      declare module 'clsx';
      declare module 'tailwind-merge';
      declare module '@supabase/supabase-js';
      declare module '@google/genai';
      declare module 'zustand' {
        export const create: any;
      }
`;
