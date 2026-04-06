<template>
  <div class="config-layout">
    <nav class="config-nav">
      <div class="nav-brand">
        <router-link to="/">NEXUS <span class="core">CORE</span></router-link>
      </div>
      <div class="nav-links">
        <router-link to="/config" class="nav-link" active-class="active">Services</router-link>
      </div>
      <div class="nav-footer">
        <span class="version">v1.1.0-Admin</span>
      </div>
    </nav>
    <main class="config-content">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.config-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #030508;
  color: #f8fafc;
}

.config-nav {
  width: 240px;
  background: #0c1018;
  border-right: 1px solid rgba(56, 189, 248, 0.1);
  display: flex;
  flex-direction: column;
  padding: 2rem 0;
}

.nav-brand {
  padding: 0 2rem 3rem;
}

.nav-brand a {
  text-decoration: none;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.nav-brand .core {
  font-weight: 300;
  color: #475569;
}

.nav-links {
  flex: 1;
}

.nav-link {
  display: block;
  padding: 1rem 2rem;
  color: #94a3b8;
  text-decoration: none;
  font-family: inherit;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.2s;
}

.nav-link:hover {
  background: rgba(14, 165, 233, 0.1);
  color: #0ea5e9;
}

.nav-link.active {
  color: #0ea5e9;
  background: rgba(14, 165, 233, 0.05);
  border-right: 2px solid #0ea5e9;
}

.nav-footer {
  padding: 2rem;
  color: #475569;
  font-size: 0.7rem;
  font-family: var(--font-mono);
}

.config-content {
  flex: 1;
  overflow-y: auto;
  padding: 3rem 4rem;
}
</style>
