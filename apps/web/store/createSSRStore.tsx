// store/createSSRStore.ts
"use client";

import { createContext, useContext, useRef } from "react";
import { devtools } from "zustand/middleware";
import { useStoreWithEqualityFn } from "zustand/traditional"; // ✅ v5에서 equality 지원 훅
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
export { shallow } from "zustand/shallow"; // ✅ 필요 시 shallow 전달용

export function createSSRStore<T extends object>(
    // v5 타입 시그니처: 제네릭에 mutators는 []로 명시
    storeInitializer: StateCreator<T, [], []>,
    options?: { devtoolsName?: string }
) {
    const StoreContext = createContext<StoreApi<T> | null>(null);

    function StoreProvider({
        children,
        initialState,
    }: {
        children: React.ReactNode;
        initialState?: Partial<T>;
    }) {
        const storeRef = useRef<StoreApi<T> | null>(null);

        if (!storeRef.current) {
            const withInitialState: StateCreator<T, [], []> = (
                set,
                get,
                api
            ) => ({
                ...storeInitializer(set, get, api),
                ...(initialState ?? {}),
            });

            const shouldUseDevtools =
                process.env.NODE_ENV === "development" &&
                process.env.NEXT_PUBLIC_ENABLE_ZUSTAND_DEVTOOLS === "true";

            storeRef.current =
                shouldUseDevtools
                    ? createStore<T>()(
                          devtools(withInitialState, {
                              name: options?.devtoolsName ?? "SSRStore",
                          })
                      )
                    : createStore<T>()(withInitialState);

            // 훅 함수 객체에 StoreApi 메서드 부착(getState, setState 등)
            Object.assign(useSSRStore, storeRef.current);
        }

        return (
            <StoreContext.Provider value={storeRef.current}>
                {children}
            </StoreContext.Provider>
        );
    }

    // ✅ selector와 equality(shallow 등) 모두 선택적으로 받을 수 있는 오버로드
    function useSSRStore(): T;
    function useSSRStore<U>(
        selector: (state: T) => U,
        equality?: (a: U, b: U) => boolean
    ): U;
    function useSSRStore<U>(
        selector?: (state: T) => U,
        equality?: (a: U, b: U) => boolean
    ) {
        const store = useContext(StoreContext);
        if (!store) throw new Error("StoreProvider가 필요합니다.");

        // 훅은 항상 같은 순서로 1회 호출됩니다(조건부 훅 호출 금지).
        const sel = selector ?? ((s) => s as unknown as U);
        // v5 규칙에 따라 equality가 필요하면 useStoreWithEqualityFn을 사용합니다.
        // equality가 없으면 Object.is를 기본 적용(기존 동작과 동일).
        return useStoreWithEqualityFn(store, sel, equality ?? Object.is);
    }

    // 훅 + StoreApi + Provider 반환 (타입 안전)
    return Object.assign(
        useSSRStore as {
            (): T;
            <U>(
                selector: (state: T) => U,
                equality?: (a: U, b: U) => boolean
            ): U;
        } & StoreApi<T>,
        { StoreProvider }
    );
}
