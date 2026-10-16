const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const React = require('react')
const { test } = require('node:test')
const assert = require('node:assert/strict')
const resolve = Module._resolveFilename
Module._resolveFilename = function(request, ...args) { return resolve.call(this, request.startsWith('@/') ? path.resolve(__dirname, '..', request.slice(2)) : request, ...args) }
const load = Module._load
Module._load = function(request, ...args) {
  if (request === 'react-native') return { StyleSheet: { create: x => x }, Platform: { select: x => x.ios }, Text: 'Text', TextInput: 'TextInput', View: 'View' }
  return load.call(this,request,...args)
}
const compile = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText,filename)
require.extensions['.ts'] = compile
require.extensions['.tsx'] = compile
const { create, act } = require('react-test-renderer')
const { TimeInput } = require('../src/components/time-input.tsx')
globalThis.IS_REACT_ACT_ENVIRONMENT = true

test('hour change survives synchronous auto-focus blur before React commits', async () => {
  const values=[]
  let renderer
  await act(() => { renderer=create(React.createElement(TimeInput,{value:'12:00',onChange:value=>values.push(value)})) })
  const hour=renderer.root.findByProps({accessibilityLabel:'Hours'})
  const minute=renderer.root.findByProps({accessibilityLabel:'Minutes'})
  // These handlers are intentionally all from the same render, as with synchronous focus/blur.
  await act(() => { hour.props.onChangeText('08'); hour.props.onBlur(); minute.props.onChangeText('35'); minute.props.onBlur() })
  assert.equal(values.at(-1),'08:35')
  assert.equal(renderer.root.findByProps({accessibilityLabel:'Hours'}).props.value,'08')
  await act(() => renderer.unmount())
})
test('invalid or empty time parts stay invalid instead of silently becoming another birth time', async () => {
  const values=[]
  let renderer
  await act(() => { renderer=create(React.createElement(TimeInput,{value:'12:00',onChange:value=>values.push(value)})) })
  const hour=renderer.root.findByProps({accessibilityLabel:'Hours'})
  await act(() => { hour.props.onChangeText('24'); hour.props.onBlur() })
  assert.equal(values.at(-1),'24:00')
  await act(() => { hour.props.onChangeText(''); hour.props.onBlur() })
  assert.equal(values.at(-1),'')
  await act(() => renderer.unmount())
})
