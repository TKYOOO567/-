function buildWarehouseGrid(zones) {
  if (!zones || zones.length === 0) {
    return { grid: [], originX: 0, originZ: 0, cellSize: 0.5, width: 0, height: 0 };
  }

  const cellSize = 0.5;
  const paddingCells = 2;

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const zone of zones) {
    const zx = zone.pos_x;
    const zz = zone.pos_z;
    const zw = zone.cols * zone.cell_width;
    const zd = zone.rows * zone.cell_depth;
    if (zx < minX) minX = zx;
    if (zz < minZ) minZ = zz;
    if (zx + zw > maxX) maxX = zx + zw;
    if (zz + zd > maxZ) maxZ = zz + zd;
  }

  const originX = minX - paddingCells * cellSize;
  const originZ = minZ - paddingCells * cellSize;
  const worldW = (maxX + paddingCells * cellSize) - originX;
  const worldH = (maxZ + paddingCells * cellSize) - originZ;
  const width = Math.ceil(worldW / cellSize);
  const height = Math.ceil(worldH / cellSize);

  const grid = [];
  for (let z = 0; z < height; z++) {
    grid[z] = new Array(width).fill(0);
  }

  for (const zone of zones) {
    const zx0 = zone.pos_x;
    const zz0 = zone.pos_z;
    const zx1 = zx0 + zone.cols * zone.cell_width;
    const zz1 = zz0 + zone.rows * zone.cell_depth;

    const gx0 = Math.floor((zx0 - originX) / cellSize);
    const gz0 = Math.floor((zz0 - originZ) / cellSize);
    const gx1 = Math.ceil((zx1 - originX) / cellSize);
    const gz1 = Math.ceil((zz1 - originZ) / cellSize);

    for (let gz = Math.max(0, gz0); gz < Math.min(height, gz1); gz++) {
      for (let gx = Math.max(0, gx0); gx < Math.min(width, gx1); gx++) {
        grid[gz][gx] = 1;
      }
    }
  }

  return { grid, originX, originZ, cellSize, width, height };
}

function aStar(grid, start, end) {
  if (!grid || grid.length === 0 || grid[0].length === 0) return null;

  const height = grid.length;
  const width = grid[0].length;

  if (start.z < 0 || start.z >= height || start.x < 0 || start.x >= width) return null;
  if (end.z < 0 || end.z >= height || end.x < 0 || end.x >= width) return null;
  if (grid[start.z][start.x] === 1 || grid[end.z][end.x] === 1) return null;

  const key = (x, z) => z * width + x;
  const heuristic = (x, z) => Math.abs(x - end.x) + Math.abs(z - end.z);

  const openSet = [{ x: start.x, z: start.z, f: heuristic(start.x, start.z) }];
  const gScore = {};
  const parent = {};
  const closedSet = new Set();

  gScore[key(start.x, start.z)] = 0;

  const directions = [
    { dx: 0, dz: -1 },
    { dx: 0, dz: 1 },
    { dx: -1, dz: 0 },
    { dx: 1, dz: 0 }
  ];

  while (openSet.length > 0) {
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet[bestIdx];
    openSet.splice(bestIdx, 1);

    const currentKey = key(current.x, current.z);

    if (current.x === end.x && current.z === end.z) {
      const path = [];
      let k = currentKey;
      while (k !== undefined) {
        const z = Math.floor(k / width);
        const x = k % width;
        path.unshift({ x, z });
        k = parent[k];
      }
      return path;
    }

    if (closedSet.has(currentKey)) continue;
    closedSet.add(currentKey);

    for (const { dx, dz } of directions) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      if (nx < 0 || nx >= width || nz < 0 || nz >= height) continue;
      if (grid[nz][nx] === 1) continue;
      const neighborKey = key(nx, nz);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG = gScore[currentKey] + 1;
      const oldG = gScore[neighborKey];
      if (oldG === undefined || tentativeG < oldG) {
        gScore[neighborKey] = tentativeG;
        parent[neighborKey] = currentKey;
        openSet.push({ x: nx, z: nz, f: tentativeG + heuristic(nx, nz) });
      }
    }
  }

  return null;
}

function worldToGrid(wx, wz, gridData) {
  const { originX, originZ, cellSize } = gridData;
  let gx = Math.floor((wx - originX) / cellSize);
  let gz = Math.floor((wz - originZ) / cellSize);
  if (gx < 0) gx = 0;
  if (gz < 0) gz = 0;
  if (gx >= gridData.width) gx = gridData.width - 1;
  if (gz >= gridData.height) gz = gridData.height - 1;
  return { x: gx, z: gz };
}

function gridToWorld(gx, gz, gridData) {
  const { originX, originZ, cellSize } = gridData;
  return {
    x: originX + gx * cellSize + cellSize / 2,
    z: originZ + gz * cellSize + cellSize / 2
  };
}

function findNearestWalkable(grid, gx, gz) {
  if (!grid || grid.length === 0) return null;
  const height = grid.length;
  const width = grid[0].length;

  if (gz >= 0 && gz < height && gx >= 0 && gx < width && grid[gz][gx] === 0) {
    return { x: gx, z: gz };
  }

  const maxRadius = Math.max(width, height);
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const nx = gx + dx;
        const nz = gz + dz;
        if (nz >= 0 && nz < height && nx >= 0 && nx < width && grid[nz][nx] === 0) {
          return { x: nx, z: nz };
        }
      }
    }
  }
  return null;
}

function findOptimalRoute(gridData, targetCells, startWorld) {
  if (!targetCells || targetCells.length === 0) {
    return { order: [], segments: [], fullPath: [] };
  }

  const startW = startWorld || { x: 0, z: 0 };
  let currentGrid = worldToGrid(startW.x, startW.z, gridData);

  const walkable = findNearestWalkable(gridData.grid, currentGrid.x, currentGrid.z);
  if (!walkable) {
    return { order: [], segments: [], fullPath: [] };
  }
  currentGrid = walkable;

  const unvisited = targetCells.map((t, i) => ({ ...t, idx: i }));
  const order = [];
  const segments = [];
  const fullPath = [];

  while (unvisited.length > 0) {
    let bestIdx = -1;
    let bestDist = Infinity;
    let bestPath = null;

    for (let i = 0; i < unvisited.length; i++) {
      const target = unvisited[i];
      const targetGridRaw = worldToGrid(target.worldX, target.worldZ, gridData);
      const targetGrid = findNearestWalkable(gridData.grid, targetGridRaw.x, targetGridRaw.z);
      if (!targetGrid) continue;
      const path = aStar(gridData.grid, currentGrid, targetGrid);
      if (path) {
        if (path.length < bestDist) {
          bestDist = path.length;
          bestIdx = i;
          bestPath = path;
        }
      }
    }

    if (bestIdx === -1) {
      for (const t of unvisited) {
        order.push({
          zone_code: t.zone_code,
          row_num: t.row_num,
          col_num: t.col_num,
          layer_num: t.layer_num,
          orderIndex: order.length,
          unreachable: true
        });
      }
      break;
    }

    const chosen = unvisited[bestIdx];
    order.push({
      zone_code: chosen.zone_code,
      row_num: chosen.row_num,
      col_num: chosen.col_num,
      layer_num: chosen.layer_num,
      orderIndex: order.length
    });

    segments.push(bestPath);

    if (fullPath.length === 0) {
      for (const node of bestPath) {
        fullPath.push({ x: node.x, z: node.z });
      }
    } else {
      for (let j = 1; j < bestPath.length; j++) {
        fullPath.push({ x: bestPath[j].x, z: bestPath[j].z });
      }
    }

    currentGrid = { x: bestPath[bestPath.length - 1].x, z: bestPath[bestPath.length - 1].z };
    unvisited.splice(bestIdx, 1);
  }

  return { order, segments, fullPath };
}

function worldPathToSegment(pathGrid, segments, gridData) {
  const fullPath = [];
  for (const node of pathGrid) {
    const world = gridToWorld(node.x, node.z, gridData);
    fullPath.push({ x: world.x, y: 0, z: world.z });
  }

  const worldSegments = [];
  for (const seg of segments) {
    const wSeg = [];
    for (const node of seg) {
      const world = gridToWorld(node.x, node.z, gridData);
      wSeg.push({ x: world.x, y: 0, z: world.z });
    }
    worldSegments.push(wSeg);
  }

  return { fullPath, segments: worldSegments };
}

module.exports = { buildWarehouseGrid, aStar, worldToGrid, gridToWorld, findOptimalRoute, worldPathToSegment };
