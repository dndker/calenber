/// <reference lib="webworker" />

import "regenerator-runtime/runtime"

import { clientsClaim } from "workbox-core"
import { precacheAndRoute } from "workbox-precaching"

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)

// 🛠 설치(install) 단계 에러 핸들링 및 자동 업데이트 시도
self.addEventListener("install", (event) => {
    event.waitUntil(
        (async () => {
            try {
                // precacheAndRoute 이미 실행됨
            } catch (err) {
                console.error("[SW] install error", err)
                await self.registration.update()
            }
        })()
    )
})

// 🛠 활성화(activate) 단계 에러 핸들링 및 자동 업데이트 시도
self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            try {
                // clientsClaim 이미 실행됨
            } catch (err) {
                console.error("[SW] activate error", err)
                await self.registration.update()
            }
        })()
    )
})

// const offlineFallback = createHandlerBoundToURL("/offline.html");
// registerRoute(
//   ({ request }) => request.mode === "navigate",
//   offlineFallback
// );

// To disable all Workbox logging during development, you can set self.__WB_DISABLE_DEV_LOGS to true
// https://developer.chrome.com/docs/workbox/troubleshooting-and-logging/#turn-off-logging-in-development-builds-in-any-workflow
//
// self.__WB_DISABLE_DEV_LOGS = true

self.addEventListener("message", (event) => {
    // HOW TO TEST THIS?
    // Run this in your browser console:
    //     window.navigator.serviceWorker.controller.postMessage({command: 'log', message: 'hello world'})
    // OR use next-pwa injected Workbox object
    //     window.workbox.messageSW({command: 'log', message: 'hello world'})
})

self.addEventListener("push", (event) => {
    const data = event.data?.json() || {}

    event?.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.message,
            icon: "/icons/android-chrome-192x192.png",
        })
    )
})
