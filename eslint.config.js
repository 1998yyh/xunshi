import js from '@eslint/js'
import globals from 'globals'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
export default [
  { ignores: ['dist/**', 'node_modules/**', 'results/**'] },
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  { files: ['**/*.{ts,vue}'], languageOptions: { globals: { ...globals.browser, ...globals.node }, parserOptions: { parser: ts.parser } }, rules: { ...js.configs.recommended.rules, 'no-undef': 'off' } },
]
