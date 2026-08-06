import React, { Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { BrandLoader } from '@/components/loading/BrandLoader'
import { Footer } from '@/components/Footer'

// Eager false for code-splitting
const modules = import.meta.glob('../../pages/**/*.{tsx,jsx}', { eager: false })

function fileToPath(file: string): string | null {
  // Normalize start
  let p = file
    .replace(/^\.\.\/\.\.\//, '/') // remove ../../
    .replace(/^\/pages/, '') // drop /pages prefix
    .replace(/\.(t|j)sx?$/, '') // drop extension

  // Ignore private/Next special files
  if (/\/(?:_app|_document)(?:\.|\/|$)/.test(p)) return null

  // Convert Next dynamic segments [id] -> :id
  p = p.replace(/\[(\.\.\.)?([^\]]+)\]/g, (_, dots: string, name: string) => {
    if (dots) return `:${name}*`
    return `:${name}`
  })

  // index -> root of its folder
  p = p.replace(/\/index$/, '/')

  // Ensure leading slash
  if (!p.startsWith('/')) p = '/' + p

  return p
}

const routes = Object.entries(modules)
  .map(([file, loader]) => {
    const path = fileToPath(file)
    if (!path) return null
    const Component = React.lazy(loader as any)
    return { path, Component }
  })
  .filter(Boolean) as { path: string; Component: React.LazyExoticComponent<any> }[]

function RouteWithFooter({ Component }: { Component: React.LazyExoticComponent<any> }) {
  const location = useLocation()
  const routePath = location.pathname
  const showFooter = routePath !== '/auth/login' && routePath !== '/Signup/page'

  return (
    <div
      data-route-path={routePath}
      style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}
    >
      <div style={{ flex: '1 0 auto', minWidth: 0 }}>
        <Component />
      </div>
      {showFooter && <Footer />}
    </div>
  )
}

export default function AutoRoutes() {
  return (
    <Suspense fallback={<BrandLoader fullScreen label="Chargement de la page..." />}>
      <Routes>
        {routes.map(({ path, Component }) => (
          <Route
            key={path}
            path={path}
            element={<RouteWithFooter Component={Component} />}
          />
        ))}
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </Suspense>
  )
}

