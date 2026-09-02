export function renderSkeletonRows(n = 5): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const tr = document.createElement("tr");
    tr.className = "placeholder";
    for (let c = 0; c < 4; c++) {
      const td = document.createElement("td");
      const div = document.createElement("div");
      div.className = "skeleton";
      td.appendChild(div);
      tr.appendChild(td);
    }
    frag.appendChild(tr);
  }
  return frag;
}
