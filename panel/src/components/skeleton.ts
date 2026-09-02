export function renderSkeletonRows(n = 5): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    const tr = document.createElement("tr");
    tr.className = "placeholder";
    const td = document.createElement("td");
    // span across 4 columns with single shimmer bar; keeps count 5 skeletons predictably
    td.colSpan = 4;
    td.style.padding = "10px 12px";
    const div = document.createElement("div");
    div.className = "skeleton";
    td.appendChild(div);
    tr.appendChild(td);
    frag.appendChild(tr);
  }
  return frag;
}
