'use client'

import { useEffect } from 'react'

function createFancyRedacted(size: 'sm' | 'md' = 'sm') {
  const wrap = document.createElement('span')
  wrap.setAttribute('data-fancyredacted', 'true')
  wrap.className = size === 'sm'
    ? 'inline-flex max-w-full items-center gap-1 font-mono text-xs'
    : 'inline-flex max-w-full items-center gap-1.5 font-mono text-sm'

  const side = () => {
    const span = document.createElement('span')
    span.className = size === 'sm'
      ? 'select-none text-zinc-700 opacity-65 text-[10px] blur-[2px]'
      : 'select-none text-zinc-700 opacity-65 text-xs blur-[3px]'
    span.textContent = 'I♡EVELYN'
    return span
  }

  const badge = document.createElement('span')
  badge.className = size === 'sm'
    ? 'select-none font-bold uppercase border border-red-900/50 bg-red-950/30 text-red-700 shadow-[0_0_18px_rgba(127,29,29,0.35)] tracking-[0.22em] px-2 py-0.5 text-[10px]'
    : 'select-none font-bold uppercase border border-red-900/50 bg-red-950/30 text-red-700 shadow-[0_0_18px_rgba(127,29,29,0.35)] tracking-[0.28em] px-3 py-1 text-sm'
  badge.textContent = 'REDACTED'

  wrap.append(side(), badge, side())
  return wrap
}

function replaceTextNode(node: Text) {
  const value = node.nodeValue ?? ''
  const parent = node.parentElement
  if (!parent) return false
  if (parent.closest('[data-fancyredacted="true"]')) return false
  if (parent.closest('input, textarea, select, option, button, script, style')) return false

  const trimmed = value.trim()
  if (!trimmed.includes('REDACTED')) return false

  if (trimmed === 'REDACTED') {
    node.replaceWith(createFancyRedacted('md'))
    return true
  }

  const match = trimmed.match(/^(.*?:\s*)REDACTED$/)
  if (match) {
    const fragment = document.createDocumentFragment()
    fragment.append(document.createTextNode(match[1]))
    fragment.append(createFancyRedacted('sm'))
    node.replaceWith(fragment)
    return true
  }

  return false
}

function walk(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }
  nodes.forEach(replaceTextNode)
}

export default function FancyRedactedHydrator() {
  useEffect(() => {
    walk(document.body)

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => walk(node))
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return null
}
