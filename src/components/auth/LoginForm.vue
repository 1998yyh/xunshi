<script setup lang="ts">
import { NButton, NInput } from 'naive-ui'
import { shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import { safeRedirect } from '../../lib/domain'
const auth = useAuth()
const router = useRouter()
const route = useRoute()
const name = shallowRef('')
const password = shallowRef('')
const error = shallowRef('')
const loading = shallowRef(false)
async function submit() {
  if (loading.value || !name.value.trim() || !password.value) return
  loading.value = true; error.value = ''
  try { await auth.login(name.value.trim(), password.value); await router.push(safeRedirect(route.query.redirect)) }
  catch { error.value = '登录失败，请检查账号、密码与网络连接' }
  finally { loading.value = false }
}
</script>
<template>
  <form
    class="login-form"
    @submit.prevent="submit"
  >
    <div>
      <label for="account">邮箱或用户名</label><NInput
        v-model:value="name"
        :input-props="{ id: 'account', autocomplete: 'username', required: true }"
        :disabled="loading"
        placeholder="输入你的团子账号"
      />
    </div><div>
      <label for="password">密码</label><NInput
        v-model:value="password"
        type="password"
        show-password-on="click"
        :input-props="{ id: 'password', autocomplete: 'current-password', required: true }"
        :disabled="loading"
        placeholder="输入密码"
      />
    </div><p
      v-if="error"
      class="notice error"
      role="alert"
    >
      {{ error }}
    </p><NButton
      type="primary"
      attr-type="submit"
      :loading="loading"
      :disabled="loading"
    >
      {{ loading ? '正在登录…' : '登录工作台' }}
    </NButton>
  </form>
</template>
