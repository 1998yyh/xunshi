<script setup lang="ts">
import LoginForm from '../components/auth/LoginForm.vue'
</script>
<template>
  <section class="login-layout">
    <div class="login-intro">
      <p class="eyebrow">
        YOUR MARKET ROUTINE
      </p><h1>每一次观察，<br>都有迹可循。</h1><p>筛选信号，建立清单，持续跟踪变化。</p><ol class="workflow-list">
        <li><span>01</span><div><strong>筛选 B 信号</strong><p>从市场数据中找到值得关注的股票</p></div></li><li><span>02</span><div><strong>加入个人观察池</strong><p>保留自己的观察节奏与入池日期</p></div></li><li><span>03</span><div><strong>跟踪 S 信号</strong><p>在变化发生时重新审视你的清单</p></div></li>
      </ol>
    </div><div class="panel login-card">
      <p class="eyebrow">
        WELCOME BACK
      </p><h2>登录循势</h2><p>沿用现有团子账号，查看你的个人观察池。</p><LoginForm /><router-link
        to="/signals"
        class="login-guest"
      >
        暂不登录，浏览公开信号 →
      </router-link>
    </div>
  </section>
</template>
