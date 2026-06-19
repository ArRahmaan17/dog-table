<script>
  import LiveExample from "./LiveExample.svelte";
  import { events, features, methods, options } from "./lib/api.js";
</script>

<main>
  <section class="border-b border-slate-200 bg-white">
    <div class="mx-auto grid max-w-6xl gap-8 px-5 py-12">
      <div class="grid gap-4">
        <p class="text-sm font-semibold uppercase tracking-widest text-cyan-700">Dog Table documentation</p>
        <h1 class="max-w-3xl text-4xl font-bold tracking-tight text-slate-950">Vanilla JavaScript data tables with opt-in state, remote, layout, and plugin features.</h1>
        <p class="max-w-3xl text-lg text-slate-600">This Svelte docs app summarizes the public behavior implemented in <code>src/</code>. The library itself remains framework-free.</p>
      </div>
      <LiveExample />
    </div>
  </section>

  <section class="mx-auto grid max-w-6xl gap-6 px-5 py-10">
    <h2 class="text-2xl font-bold text-slate-950">Capabilities</h2>
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each features as feature}
        <article class="rounded-lg border border-slate-200 bg-white p-4">
          <h3 class="font-semibold text-slate-950">{feature.title}</h3>
          <p class="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
          <pre class="mt-3 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100"><code>{feature.code}</code></pre>
        </article>
      {/each}
    </div>
  </section>

  <section class="mx-auto grid max-w-6xl gap-6 px-5 py-10">
    <h2 class="text-2xl font-bold text-slate-950">Configuration From Code</h2>
    <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {#each options as option}
        <div class="grid gap-2 border-b border-slate-200 p-4 last:border-b-0 md:grid-cols-[220px_1fr]">
          <code>{option[0]}</code>
          <p class="text-sm text-slate-600">{option[1]}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="mx-auto grid max-w-6xl gap-6 px-5 py-10">
    <h2 class="text-2xl font-bold text-slate-950">Methods And Events</h2>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h3 class="font-semibold text-slate-950">Public methods</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          {#each methods as method}
            <code>{method}</code>
          {/each}
        </div>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-4">
        <h3 class="font-semibold text-slate-950">Standard events</h3>
        <div class="mt-3 flex flex-wrap gap-2">
          {#each events as event}
            <code>{event}</code>
          {/each}
        </div>
      </div>
    </div>
  </section>
</main>
