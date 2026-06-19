<script>
  import { onMount } from "svelte";
  import { DogTable } from "../../src/data-table.js";
  import { columns, rows } from "./lib/sample.js";

  let host;
  let table;
  let lastEvent = "Waiting for table events";

  onMount(() => {
    table = new DogTable(host, {
      data: rows,
      columns,
      pageSize: 3,
      filterRow: true,
      persistence: "local",
      persistenceKey: "dog-table-docs",
      stickyHeader: true,
      stickyColumns: ["id"],
      resizableColumns: true,
      columnReorder: true,
      footerAggregates: {
        amount: "sum",
        age: "avg",
      },
      groupBy: "status",
      groupAggregates: {
        amount: "sum",
      },
    }).init();

    table.on("state:change", ({ state }) => {
      lastEvent = `state:change page=${state.currentPage} rows=${state.rawData.length}`;
    });
    table.on("row:add", ({ row }) => {
      lastEvent = `row:add ${row.name}`;
    });
    table.on("row:update", ({ rowId }) => {
      lastEvent = `row:update ${rowId}`;
    });

    return () => table.destroy();
  });

  function addRow() {
    const id = Date.now();
    table.addRow({
      id,
      name: "New dog",
      breed: "Mixed",
      age: 2,
      status: "active",
      amount: 160,
    });
  }

  function hideBreed() {
    table.toggleColumn("breed");
  }

  function activeOnly() {
    table.setFilters({ status: "active" });
  }

  function clearFilters() {
    table.clearFilters();
  }
</script>

<section class="grid gap-4">
  <div class="flex flex-wrap gap-2">
    <button class="rounded bg-slate-900 px-3 py-2 text-sm font-semibold text-white" on:click={addRow}>Add row</button>
    <button class="rounded bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300" on:click={hideBreed}>Toggle breed</button>
    <button class="rounded bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300" on:click={activeOnly}>Active filter</button>
    <button class="rounded bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300" on:click={clearFilters}>Clear filters</button>
  </div>
  <div bind:this={host}></div>
  <p class="rounded bg-slate-100 px-3 py-2 text-sm text-slate-600">{lastEvent}</p>
</section>
