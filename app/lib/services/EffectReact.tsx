// app/lib/services/EffectReact.tsx
import React, { createContext, useContext, useMemo } from 'react';
import type { Context } from 'effect';
import { clientRuntime } from './VideoEditorClientApp';

const EffectRuntimeContext = createContext(clientRuntime);

/**
 * Hook to access an Effect service within a React component
 */
export const useEffectService = <A, R>(tag: Context.Tag<A, R>): A => {
    const runtime = useContext(EffectRuntimeContext);
    // In Effect 3.x, Tag can be used directly as an Effect
    // Since tag is a Tag<A, R>, runtime.runSync(tag) returns A
    return useMemo(() => runtime.runSync(tag as any), [runtime, tag]);
};

/**
 * Provider to inject the Effect runtime into the React component tree
 */
export const EffectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <EffectRuntimeContext.Provider value={clientRuntime}>
            {children}
        </EffectRuntimeContext.Provider>
    );
};
