import type { GlobalThemeOverrides } from 'naive-ui'

// 控件与弹出菜单共用主题，避免 Teleport 到 body 后丢失工作台配色。
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    primaryColor: '#304f9f',
    primaryColorHover: '#4164b5',
    primaryColorPressed: '#243f86',
    primaryColorSuppl: '#304f9f',
    successColor: '#304f9f',
    successColorHover: '#4164b5',
    successColorPressed: '#243f86',
    successColorSuppl: '#304f9f',
    infoColor: '#304f9f',
    warningColor: '#ac7646',
    errorColor: '#b25344',
    textColorBase: '#202a3b',
    textColor1: '#202a3b',
    textColor2: '#46536a',
    textColor3: '#6b7280',
    placeholderColor: '#9098a8',
    borderColor: '#d6dce7',
    hoverColor: '#f4f6fa',
    borderRadius: '9px',
    borderRadiusSmall: '6px',
    fontSize: '12px',
    fontSizeSmall: '11px',
    fontSizeMedium: '12px',
    heightMedium: '42px',
    heightSmall: '34px',
  },
  Button: { fontWeight: '550' },
  Input: { boxShadowFocus: '0 0 0 3px #304f9f14' },
  Select: {
    peers: {
      InternalSelection: { boxShadowFocus: '0 0 0 3px #304f9f14' },
      InternalSelectMenu: {
        borderRadius: '10px',
        optionTextColorActive: '#304f9f',
        optionColorActive: '#eef2fb',
        optionColorPending: '#f4f6fa',
        optionHeightMedium: '40px',
      },
    },
  },
  Radio: { buttonColorActive: '#eef2fb', buttonTextColorActive: '#304f9f' },
}
