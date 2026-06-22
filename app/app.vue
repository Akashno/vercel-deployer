<template>
  <NuxtPage />
</template>

<style>
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  background: #000;
  color: #ededed;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track { background: #0a0a0a; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #444; }
</style>
