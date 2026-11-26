import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity, FiArrowUpRight, FiBox, FiChevronDown, FiChevronRight,
  FiMapPin, FiPackage, FiRefreshCw, FiSearch, FiShield, FiShoppingBag, FiUserPlus,
  FiTruck, FiUsers
} from 'react-icons/fi';
import { supabase } from '../services/supabase';
import '../styles/supplier-company-workspace.css';

const ORDER_DONE = new Set(['received', 'completed']);
const ORDER_OPEN = new Set(['pending_approval', 'sent_to_supplier', 'approved', 'confirmed', 'processing']);

const normalise = (value) => String(value || '').trim().toLowerCase();
const idSet = (...values) => [...new Set(values.flat().filter(Boolean))];
const lineQty = (line) => Number(line?.quantity ?? line?.qty ?? line?.units ?? 0) || 0;
const lineName = (line) => line?.product_name || line?.name || line?.product?.name || 'Product';
const lineProductId = (line) => line?.product_id || line?.product?.id || null;
const statusLabel = (status) => String(status || 'pending').replaceAll('_', ' ');

const SupplierCompanyWorkspace = ({ user, companyName }) => {
  const [data, setData] = useState({ managers: [], workers: [], applications: [], stores: [], products: [], stock: [], orders: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleResults, setPeopleResults] = useState([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [expandedManagers, setExpandedManagers] = useState({});
  const [expandedWorkers, setExpandedWorkers] = useState({});
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [assigningWorker, setAssigningWorker] = useState('');
  const [assignToManager, setAssignToManager] = useState('');
  const [notice, setNotice] = useState('');
  const [showOrders, setShowOrders] = useState(false);

  const role = normalise(user?.supplier_company_role);
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';

  const load = useCallback(async (quiet = false) => {
    if (!user?.id || !user?.supplier_company_id) return;
    quiet ? setRefreshing(true) : setLoading(true);
    if (!quiet) setNotice('');
    try {
      let membershipQuery = supabase.from('supplier_company_members')
        .select('id, user_id, role, manager_user_id, status')
        .eq('company_supplier_id', user.supplier_company_id)
        .eq('status', 'active');
      if (isManager) membershipQuery = membershipQuery.or(`user_id.eq.${user.id},manager_user_id.eq.${user.id}`);
      if (role === 'supplier') membershipQuery = membershipQuery.eq('user_id', user.id);
      const { data: membershipRows, error: membershipError } = await membershipQuery;
      if (membershipError) throw membershipError;

      const memberUserIds = idSet((membershipRows || []).map((item) => item.user_id));
      const { data: companyUsers, error: companyUsersError } = memberUserIds.length
        ? await supabase.from('users')
          .select('id, auth_id, full_name, email, phone, role, is_active, created_at')
          .in('id', memberUserIds)
        : { data: [], error: null };
      if (companyUsersError) throw companyUsersError;
      const companyUserById = new Map((companyUsers || []).map((item) => [item.id, item]));
      const companyMembers = (membershipRows || []).map((member) => ({
        ...(companyUserById.get(member.user_id) || { id: member.user_id }),
        company_membership_id: member.id,
        company_role: member.role,
        company_manager_user_id: member.manager_user_id,
        company_member_status: member.status
      }));
      let managerRows = companyMembers.filter((member) => member.company_role === 'manager');
      let workerRows = companyMembers.filter((member) => member.company_role === 'supplier');
      if (isManager) managerRows = [user];
      if (role === 'supplier' && user.supplier_company_manager_id) {
        let manager = companyUserById.get(user.supplier_company_manager_id);
        if (!manager) {
          const { data: managerUser } = await supabase.from('users')
            .select('id, auth_id, full_name, email, phone, role, is_active, created_at')
            .eq('id', user.supplier_company_manager_id)
            .maybeSingle();
          manager = managerUser;
        }
        if (manager) managerRows = [manager];
      }

      const workerIds = idSet(workerRows.map((item) => item.id), workerRows.map((item) => item.auth_id));
      let applications = [];
      let stores = [];
      let supplierProfiles = [];
      let products = [];
      let stock = [];
      let orders = [];

      const companySupplierUserIds = isAdmin ? idSet(user.id, user.auth_id) : [];
      const linkedUserIds = idSet(workerIds, companySupplierUserIds);

      if (linkedUserIds.length) {
        const [{ data: applicationRows }, { data: profiles }, { data: orderRows }] = await Promise.all([
          supabase.from('supplier_applications')
            .select('id, supermarket_id, supplier_user_id, business_name, status, product_categories, created_at')
            .in('supplier_user_id', linkedUserIds),
          supabase.from('suppliers').select('id, user_id, company_name, is_active').in('user_id', linkedUserIds),
          supabase.from('purchase_orders')
            .select('id, po_number, manager_id, supplier_id, supermarket_id, supplier_name, status, items, total_amount, ordered_at, updated_at')
            .in('supplier_id', linkedUserIds).order('ordered_at', { ascending: false }).limit(500)
        ]);
        applications = applicationRows || [];
        supplierProfiles = profiles || [];
        orders = orderRows || [];

        const { data: sharedStock } = await supabase.rpc('get_supplier_company_store_stock_v1', {
          p_company_supplier_id: user.supplier_company_id
        });
        stock = (sharedStock?.products || []).map((item) => ({
          product_id: item.product_id,
          supermarket_id: item.supermarket_id,
          quantity: item.current_stock ?? item.available_stock,
          reorder_level: item.reorder_point
        }));

        const storeIds = idSet(applications.map((item) => item.supermarket_id), orders.map((item) => item.supermarket_id), stock.map((item) => item.supermarket_id));
        if (storeIds.length) {
          const { data: storeRows } = await supabase.from('supermarkets')
            .select('id, name, location, address, is_active').in('id', storeIds).order('name');
          stores = storeRows || [];
        }

        const supplierProfileIds = idSet(supplierProfiles.map((item) => item.id));
        const { data: linkedProducts } = await supabase.from('supplier_products')
          .select('supplier_id, product_id, is_active').in('supplier_id', linkedUserIds);
        if (supplierProfileIds.length) {
          const { data: catalogRows } = await supabase.from('products')
            .select('id, name, sku, category, supplier_id, supermarket_id, is_active').in('supplier_id', supplierProfileIds).order('name');
          products = (catalogRows || []).map((product) => ({
            ...product,
            supplier_user_id: workerRows.find((worker) => {
              const profile = supplierProfiles.find((item) => item.id === product.supplier_id);
              return profile && (worker.id === profile.user_id || worker.auth_id === profile.user_id);
            })?.id || supplierProfiles.find((profile) => profile.id === product.supplier_id)?.user_id,
            supplier_link_active: (() => {
              const profile = supplierProfiles.find((item) => item.id === product.supplier_id);
              const owner = workerRows.find((worker) => profile && (worker.id === profile.user_id || worker.auth_id === profile.user_id));
              const ownerIds = idSet(owner?.id, owner?.auth_id, profile?.user_id);
              return linkedProducts?.find((link) => link.product_id === product.id && ownerIds.includes(link.supplier_id))?.is_active;
            })()
          }));
        }

        // Some older catalogs use the supplier_products link table instead of
        // products.supplier_id. Merge those entries when the table is available.
        {
          const missingLinks = (linkedProducts || []).filter((link) => !products.some((product) => {
            const owner = workerRows.find((worker) => worker.id === product.supplier_user_id || worker.auth_id === product.supplier_user_id);
            return product.id === link.product_id && owner && idSet(owner.id, owner.auth_id).includes(link.supplier_id);
          }));
          const linkedIds = idSet(missingLinks.map((item) => item.product_id));
          if (linkedIds.length) {
            const { data: productRows } = await supabase.from('products')
              .select('id, name, sku, category, supermarket_id, is_active').in('id', linkedIds).order('name');
            const expandedRows = (productRows || []).flatMap((product) => missingLinks
              .filter((link) => link.product_id === product.id)
              .map((link) => ({
                ...product,
                supplier_user_id: workerRows.find((worker) => worker.id === link.supplier_id || worker.auth_id === link.supplier_id)?.id || link.supplier_id,
                supplier_link_active: link.is_active
              })));
            products = [...products, ...expandedRows];
          }
        }

      }

      setData({ managers: managerRows, workers: workerRows, applications, stores, products, stock, orders });
      if (isAdmin && managerRows.length === 1) setAssignToManager(managerRows[0].id);
      if (role === 'supplier' && workerRows[0]) {
        setExpandedWorkers({ [workerRows[0].id]: true });
        setExpandedManagers(workerRows[0].company_manager_user_id ? { [workerRows[0].company_manager_user_id]: true } : {});
      }
    } catch (error) {
      console.warn('[SupplierCompanyWorkspace] Could not load supply team data:', error);
      setNotice(error?.message || 'Some team information could not be loaded. Refresh to try again.');
      setData({ managers: [], workers: [], applications: [], stores: [], products: [], stock: [], orders: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin, isManager, role, user]);

  useEffect(() => { load(); }, [load]);

  const storesById = useMemo(() => new Map(data.stores.map((store) => [store.id, store])), [data.stores]);
  const workerById = useMemo(() => {
    const rows = data.workers.flatMap((worker) => [[worker.id, worker], ...(worker.auth_id ? [[worker.auth_id, worker]] : [])]);
    if (isAdmin) {
      const companyAccount = { ...user, full_name: companyName || user.full_name || 'Company account' };
      rows.push([user.id, companyAccount]);
      if (user.auth_id) rows.push([user.auth_id, companyAccount]);
    }
    return new Map(rows);
  }, [data.workers, isAdmin, user, companyName]);
  const managerById = useMemo(() => new Map(data.managers.flatMap((manager) => [[manager.id, manager], ...(manager.auth_id ? [[manager.auth_id, manager]] : [])])), [data.managers]);

  const workerStats = useMemo(() => {
    const map = new Map();
    data.workers.forEach((worker) => map.set(worker.id, { orders: 0, fulfilled: 0, units: 0, volume: 0, pending: 0 }));
    data.orders.forEach((order) => {
      const worker = workerById.get(order.supplier_id);
      if (!worker) return;
      const stats = map.get(worker.id) || { orders: 0, fulfilled: 0, units: 0, volume: 0, pending: 0 };
      stats.orders += 1;
      if (ORDER_DONE.has(normalise(order.status))) {
        stats.fulfilled += 1;
        stats.volume += Number(order.total_amount || 0);
        (Array.isArray(order.items) ? order.items : []).forEach((item) => { stats.units += lineQty(item); });
      } else if (ORDER_OPEN.has(normalise(order.status))) stats.pending += 1;
      map.set(worker.id, stats);
    });
    return map;
  }, [data.orders, data.workers, workerById]);

  const managerStats = useMemo(() => {
    const map = new Map();
    data.managers.forEach((manager) => map.set(manager.id, { workers: 0, fulfilled: 0, units: 0, pending: 0 }));
    data.workers.forEach((worker) => {
      const manager = managerById.get(worker.company_manager_user_id);
      if (!manager) return;
      const stats = map.get(manager.id) || { workers: 0, fulfilled: 0, units: 0, pending: 0 };
      const workerPerf = workerStats.get(worker.id) || {};
      stats.workers += 1;
      stats.fulfilled += workerPerf.fulfilled || 0;
      stats.units += workerPerf.units || 0;
      stats.pending += workerPerf.pending || 0;
      map.set(manager.id, stats);
    });
    return map;
  }, [data.managers, data.workers, managerById, workerStats]);

  const movingProducts = useMemo(() => {
    const totals = new Map();
    data.orders.filter((order) => ORDER_DONE.has(normalise(order.status))).forEach((order) => {
      (Array.isArray(order.items) ? order.items : []).forEach((item) => {
        const key = lineProductId(item) || lineName(item);
        const current = totals.get(key) || { id: key, name: lineName(item), units: 0 };
        current.units += lineQty(item);
        totals.set(key, current);
      });
    });
    return [...totals.values()].sort((a, b) => b.units - a.units);
  }, [data.orders]);

  const pendingOrders = data.orders.filter((order) => ORDER_OPEN.has(normalise(order.status)));
  const fulfilledOrders = data.orders.filter((order) => ORDER_DONE.has(normalise(order.status)));
  const topWorker = [...data.workers].sort((a, b) => (workerStats.get(b.id)?.units || 0) - (workerStats.get(a.id)?.units || 0)).find((worker) => (workerStats.get(worker.id)?.units || 0) > 0);
  const topManager = [...data.managers].sort((a, b) => (managerStats.get(b.id)?.units || 0) - (managerStats.get(a.id)?.units || 0)).find((manager) => (managerStats.get(manager.id)?.units || 0) > 0);
  const topProduct = movingProducts[0];

  const applicationsForWorker = (worker) => data.applications.filter((application) => application.supplier_user_id === worker.id || application.supplier_user_id === worker.auth_id);
  const ordersForWorker = (worker) => data.orders.filter((order) => order.supplier_id === worker.id || order.supplier_id === worker.auth_id);
  const storesForWorker = (worker) => {
    const linked = applicationsForWorker(worker).map((application) => application.supermarket_id);
    const ordered = ordersForWorker(worker).map((order) => order.supermarket_id);
    return idSet(linked, ordered).map((id) => ({ id, ...storesById.get(id), application: applicationsForWorker(worker).find((item) => item.supermarket_id === id) }));
  };

  const assignWorker = async (workerId, managerId) => {
    setAssigningWorker(workerId);
    setNotice('');
    const { data: updated, error } = await supabase.from('supplier_company_members')
      .update({ manager_user_id: managerId || null })
      .eq('company_supplier_id', user.supplier_company_id)
      .eq('user_id', workerId)
      .eq('role', 'supplier')
      .select('id')
      .maybeSingle();
    if (error || !updated) setNotice(error?.message || 'This supplier worker could not be reassigned.');
    else await load(true);
    setAssigningWorker('');
  };

  const searchPeople = async (event) => {
    event.preventDefault();
    const term = peopleSearch.trim();
    if (term.length < 2) {
      setNotice('Enter at least two characters to find a registered user.');
      return;
    }
    setSearchingPeople(true);
    setNotice('');
    const pattern = `%${term}%`;
    const [byName, byEmail] = await Promise.all([
      supabase.from('users').select('id, auth_id, full_name, email, phone, role, supermarket_id').ilike('full_name', pattern).limit(15),
      supabase.from('users').select('id, auth_id, full_name, email, phone, role, supermarket_id').ilike('email', pattern).limit(15)
    ]);
    const merged = new Map();
    [...(byName.data || []), ...(byEmail.data || [])].forEach((person) => merged.set(person.id, person));
    const candidates = [...merged.values()].filter((person) => person.id !== user.id);
    setPeopleResults(candidates);
    const error = byName.error || byEmail.error;
    if (error) setNotice(error.message || 'Could not search registered users.');
    else if (candidates.length === 0) setNotice('No registered users matched. They need to create an account before they can be assigned.');
    setSearchingPeople(false);
  };

  const addTeamMember = async (person, teamRole) => {
    setAssigningWorker(person.id);
    setNotice('');
    const { data: updated, error } = await supabase.from('supplier_company_members').upsert({
      company_supplier_id: user.supplier_company_id,
      user_id: person.id,
      role: teamRole,
      manager_user_id: teamRole === 'supplier' ? assignToManager || null : null,
      status: 'active',
      created_by: user.id
    }, { onConflict: 'company_supplier_id,user_id' }).select('id').maybeSingle();
    if (error || !updated) {
      setNotice(error?.message || 'Could not add this person to the supply team.');
    } else {
      let resultMessage = `${person.full_name || person.email} added as ${teamRole === 'supplier' ? 'a supplier worker' : 'a manager'}.`;
      if (teamRole === 'supplier') {
        const { data: existingSupplier, error: profileLookupError } = await supabase.from('suppliers')
          .select('id').in('user_id', idSet(person.id, person.auth_id)).limit(1).maybeSingle();
        if (profileLookupError) resultMessage += ` Supplier profile setup needs attention: ${profileLookupError.message}`;
        else if (!existingSupplier) {
          const { error: profileError } = await supabase.from('suppliers').insert({
            user_id: person.id,
            company_name: companyName || 'Supplier Company'
          });
          if (profileError) resultMessage += ` Supplier profile setup needs attention: ${profileError.message}`;
        }
      }
      setPeopleResults((current) => current.filter((entry) => entry.id !== person.id));
      setNotice(resultMessage);
      await load(true);
    }
    setAssigningWorker('');
  };

  const filteredWorkers = data.workers.filter((worker) => `${worker.full_name || ''} ${worker.email || ''}`.toLowerCase().includes(search.toLowerCase()));
  const managerRows = data.managers;

  const renderWorker = (worker) => {
    const stats = workerStats.get(worker.id) || {};
    const workerStores = storesForWorker(worker);
    const isExpanded = Boolean(expandedWorkers[worker.id]);
    const hasManager = Boolean(managerById.get(worker.company_manager_user_id));
    return (
      <article className="scw-worker" key={worker.id}>
        <button className="scw-row scw-worker-row" onClick={() => setExpandedWorkers((current) => ({ ...current, [worker.id]: !current[worker.id] }))} aria-expanded={isExpanded}>
          <span className="scw-avatar worker-avatar">{(worker.full_name || 'S').slice(0, 1).toUpperCase()}</span>
          <span className="scw-row-main"><b>{worker.full_name || 'Supplier worker'}</b><small>{worker.email || worker.phone || 'Contact details not added'}</small></span>
          <span className="scw-row-stat"><b>{workerStores.length}</b><small>stores served</small></span>
          <span className="scw-row-stat"><b>{stats.units || 0}</b><small>units supplied</small></span>
          <span className={`scw-status ${worker.company_member_status === 'active' ? 'active' : 'review'}`}>{worker.company_member_status === 'active' ? 'Active' : 'Inactive'}</span>
          {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
        </button>
        {isExpanded && <div className="scw-worker-detail">
          <div className="scw-worker-tools">
            <div><span className="scw-kicker">Supplier worker</span><p>{stats.fulfilled || 0} fulfilled orders · {stats.pending || 0} awaiting action</p></div>
            {isAdmin && <label className="scw-manager-select"><span>Assigned manager</span><select value={hasManager ? worker.company_manager_user_id : ''} onChange={(event) => assignWorker(worker.id, event.target.value)} disabled={assigningWorker === worker.id}>
              <option value="">Unassigned</option>
              {data.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || manager.email}</option>)}
            </select></label>}
          </div>
          <div className="scw-store-list">
            {workerStores.length ? workerStores.map((store) => {
              const appStatus = store.application?.status || (ordersForWorker(worker).some((order) => order.supermarket_id === store.id) ? 'active' : 'pending');
              const active = selectedStoreId === `${worker.id}:${store.id}`;
              return <div className="scw-store-wrap" key={`${worker.id}:${store.id}`}>
                <button className={`scw-store-row${active ? ' selected' : ''}`} onClick={() => setSelectedStoreId(active ? null : `${worker.id}:${store.id}`)} aria-expanded={active}>
                  <span className="scw-store-icon"><FiShoppingBag /></span>
                  <span className="scw-row-main"><b>{store.name || 'Store'}</b><small><FiMapPin /> {store.location || store.address || 'Location not listed'}</small></span>
                  <span className={`scw-status ${normalise(appStatus) === 'approved' || normalise(appStatus) === 'active' ? 'active' : normalise(appStatus) === 'rejected' ? 'rejected' : 'review'}`}>{statusLabel(appStatus)}</span>
                  {active ? <FiChevronDown /> : <FiChevronRight />}
                </button>
                {active && <StoreProducts storeId={store.id} worker={worker} products={data.products} stock={data.stock} orders={ordersForWorker(worker)} />}
              </div>;
            }) : <div className="scw-empty-inline">No store assignments yet. Store applications and confirmed orders will show here.</div>}
          </div>
        </div>}
      </article>
    );
  };

  const renderManager = (manager) => {
    const managerIds = idSet(manager.id, manager.auth_id);
    const team = filteredWorkers.filter((worker) => managerIds.includes(worker.company_manager_user_id));
    const stats = managerStats.get(manager.id) || {};
    const open = expandedManagers[manager.id] !== false;
    return <section className="scw-manager" key={manager.id}>
      <button className="scw-row scw-manager-row" onClick={() => setExpandedManagers((current) => ({ ...current, [manager.id]: current[manager.id] === false }))} aria-expanded={open}>
        <span className="scw-avatar manager-avatar"><FiUsers /></span>
        <span className="scw-row-main"><b>{manager.full_name || 'Supply manager'}</b><small>{manager.email || 'Manager'}{manager.phone ? ` · ${manager.phone}` : ''}</small></span>
        <span className="scw-row-stat"><b>{team.length}</b><small>workers</small></span>
        <span className="scw-row-stat"><b>{stats.units || 0}</b><small>units supplied</small></span>
        <span className="scw-status active">Active</span>
        {open ? <FiChevronDown /> : <FiChevronRight />}
      </button>
      {open && <div className="scw-team-list">{team.length ? team.map(renderWorker) : <div className="scw-empty-inline">No supplier workers assigned to this manager yet.</div>}</div>}
    </section>;
  };

  if (showOrders) {
    const allOrderRows = [...data.orders].sort((a, b) => new Date(b.ordered_at || b.updated_at || 0) - new Date(a.ordered_at || a.updated_at || 0));
    const productNames = new Map(data.products.map((product) => [product.id, product.name]));
    const stockRows = data.stock.map((row) => ({
      ...row,
      productName: productNames.get(row.product_id) || 'Product',
      storeName: storesById.get(row.supermarket_id)?.name || 'Store'
    }));
    return <main className="scw">
      <header className="scw-hero">
        <div><span className="scw-kicker">Supplier company · Orders & stock</span><h2>Orders across your supply team</h2><p>Review order approval status and the current stock levels your team can access.</p></div>
        <div className="scw-hero-actions"><button className="scw-button quiet" onClick={() => setShowOrders(false)}>Back to team</button><button className="scw-button quiet" onClick={() => load(true)} disabled={refreshing}><FiRefreshCw className={refreshing ? 'scw-spin' : ''} /> Refresh</button></div>
      </header>
      <section className="scw-card">
        <div className="scw-section-head"><div><span className="scw-kicker">Order approvals</span><h3>Latest purchase orders</h3><p>Orders marked approved, confirmed, or received have passed the approval step.</p></div></div>
        {allOrderRows.length ? <div className="scw-order-table">
          <div className="scw-order-labels"><span>Order</span><span>Store</span><span>Supplier worker</span><span>Status</span><span>Date</span></div>
          {allOrderRows.map((order) => <div className="scw-order-table-row" key={order.id}>
            <span><b>{order.po_number || `Order ${String(order.id).slice(0, 8)}`}</b><small>{Array.isArray(order.items) ? order.items.length : 0} product lines</small></span>
            <span>{storesById.get(order.supermarket_id)?.name || 'Store'}</span>
            <span>{workerById.get(order.supplier_id)?.full_name || order.supplier_name || 'Supplier worker'}</span>
            <span><span className={`scw-status ${['approved', 'confirmed', 'received', 'completed'].includes(normalise(order.status)) ? 'active' : 'review'}`}>{statusLabel(order.status)}</span></span>
            <span>{order.ordered_at ? new Date(order.ordered_at).toLocaleDateString() : '—'}</span>
          </div>)}
        </div> : <div className="scw-empty-inline">No supplier orders have been placed yet.</div>}
      </section>
      <section className="scw-card">
        <div className="scw-section-head"><div><span className="scw-kicker">Shared stock levels</span><h3>Current stock at stores served</h3><p>Stock appears here when it is available to this supplier team.</p></div></div>
        {stockRows.length ? <div className="scw-order-table">
          <div className="scw-stock-labels"><span>Product</span><span>Store</span><span>On hand</span><span>Restock at</span><span>Level</span></div>
          {stockRows.map((row) => {
            const low = row.quantity != null && Number(row.quantity) <= Number(row.reorder_level || 0);
            return <div className="scw-stock-row" key={`${row.supermarket_id}:${row.product_id}`}><b>{row.productName}</b><span>{row.storeName}</span><span>{row.quantity ?? '—'} units</span><span>{row.reorder_level ?? '—'}</span><span className={`scw-status ${low ? 'review' : 'active'}`}>{low ? 'Reorder' : 'Healthy'}</span></div>;
          })}
        </div> : <div className="scw-empty-inline">No shared stock levels are available for this team yet.</div>}
      </section>
    </main>;
  }

  return <main className="scw">
    <header className="scw-hero">
      <div><span className="scw-kicker">Supply company · {isAdmin ? 'Admin workspace' : isManager ? 'Manager workspace' : 'Supplier workspace'}</span>
        <h2>{isAdmin ? 'Your supply team, at a glance' : isManager ? 'Your assigned supply team' : 'The stores you serve'}</h2>
        <p>{isAdmin ? 'Organize managers and supplier workers, track store approvals, and spot what is moving.' : isManager ? 'Keep your supplier workers and the stores they serve moving together.' : 'See your store assignments, product approvals, order activity, and stock levels.'}</p>
      </div>
      <div className="scw-hero-actions">
        <button className="scw-button quiet" onClick={() => load(true)} disabled={refreshing}><FiRefreshCw className={refreshing ? 'scw-spin' : ''} /> Refresh</button>
      </div>
    </header>

    {notice && <div className="scw-notice" role="status">{notice}</div>}

    {loading ? <div className="scw-loading"><FiRefreshCw className="scw-spin" /> Loading your supply network…</div> : <>
      <section className="scw-stats">
        <Stat icon={<FiUsers />} label={isAdmin ? 'Managers' : 'Team members'} value={isAdmin ? data.managers.length : isManager ? data.workers.length : 1} note={isAdmin ? 'Supply areas covered' : isManager ? 'Assigned supplier workers' : 'Your supplier account'} />
        <Stat icon={<FiStore />} label="Stores served" value={idSet(data.applications.map((item) => item.supermarket_id), data.orders.map((item) => item.supermarket_id)).length} note="Approved links and active orders" />
        <Stat icon={<FiPackage />} label="Open orders" value={pendingOrders.length} note="Across the visible team" tone={pendingOrders.length ? 'warm' : ''} />
        <Stat icon={<FiTruck />} label="Orders fulfilled" value={fulfilledOrders.length} note="Received or completed" tone="green" />
      </section>

      {isAdmin && <section className="scw-insights">
        <Insight eyebrow="Leading manager" name={topManager?.full_name || 'No manager activity yet'} detail={topManager ? `${managerStats.get(topManager.id)?.units || 0} units fulfilled by the team` : 'Fulfilled orders will build this ranking'} icon={<FiShield />} />
        <Insight eyebrow="Top supplier worker" name={topWorker?.full_name || 'No supplier activity yet'} detail={topWorker ? `${workerStats.get(topWorker.id)?.units || 0} units fulfilled` : 'Completed orders will build this ranking'} icon={<FiTruck />} />
        <Insight eyebrow="Most supplied product" name={topProduct?.name || 'No product movement yet'} detail={topProduct ? `${topProduct.units} units in fulfilled orders` : 'Product quantities from fulfilled orders appear here'} icon={<FiActivity />} />
      </section>}

      {isAdmin && <section className="scw-card scw-add-team">
        <div className="scw-section-head"><div><span className="scw-kicker">Add to the supply company</span><h3>Find a registered user</h3><p>Like store staff setup, people create an account first; then you assign their supply role here.</p></div><FiUserPlus className="scw-head-icon" /></div>
        <form className="scw-add-form" onSubmit={searchPeople}>
          <label className="scw-search"><FiSearch /><input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Search by name or email" /></label>
          <label className="scw-manager-select"><span>Supplier workers report to</span><select value={assignToManager} onChange={(event) => setAssignToManager(event.target.value)}><option value="">Leave unassigned</option>{data.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || manager.email}</option>)}</select></label>
          <button className="scw-button" type="submit" disabled={searchingPeople}>{searchingPeople ? 'Searching…' : 'Search users'}</button>
        </form>
        {peopleResults.length > 0 && <div className="scw-candidate-list">{peopleResults.map((person) => <div className="scw-candidate" key={person.id}>
          <span className="scw-avatar worker-avatar">{(person.full_name || 'U').slice(0, 1).toUpperCase()}</span>
          <span className="scw-row-main"><b>{person.full_name || 'Registered user'}</b><small>{person.email || person.phone || 'Contact details not added'} · Current role: {person.role || 'customer'}</small></span>
          <button type="button" className="scw-assign-button manager-assign" disabled={assigningWorker === person.id} onClick={() => addTeamMember(person, 'manager')}>Add manager</button>
          <button type="button" className="scw-assign-button supplier-assign" disabled={assigningWorker === person.id} onClick={() => addTeamMember(person, 'supplier')}>Add supplier</button>
        </div>)}</div>}
      </section>}

      <section className="scw-card">
        <div className="scw-section-head"><div><span className="scw-kicker">People & coverage</span><h3>{isAdmin ? 'Managers and their supplier workers' : isManager ? 'Supplier workers assigned to you' : 'Your supply coverage'}</h3><p>Open a person, then open a store to see products and stock.</p></div>
          <label className="scw-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" /></label>
        </div>
        {isAdmin ? <div className="scw-hierarchy">
          {managerRows.length ? managerRows.map(renderManager) : <div className="scw-empty"><FiUsers /><b>No managers yet</b><span>Add a manager to organize supplier workers by area.</span></div>}
          {filteredWorkers.some((worker) => !managerById.has(worker.company_manager_user_id)) && <section className="scw-manager unassigned">
            <div className="scw-unassigned-head"><b>Unassigned supplier workers</b><span>{filteredWorkers.filter((worker) => !managerById.has(worker.company_manager_user_id)).length}</span></div>
            <div className="scw-team-list">{filteredWorkers.filter((worker) => !managerById.has(worker.company_manager_user_id)).map(renderWorker)}</div>
          </section>}
        </div> : isManager ? <div className="scw-hierarchy">{filteredWorkers.length ? filteredWorkers.map(renderWorker) : <div className="scw-empty"><FiUsers /><b>No supplier workers assigned yet</b><span>Ask your company admin to assign supplier workers to your area.</span></div>}</div> : <div className="scw-hierarchy">{data.workers.map(renderWorker)}</div>}
      </section>

      <section className="scw-lower-grid">
        <div className="scw-card">
          <div className="scw-section-head compact"><div><span className="scw-kicker">Order desk</span><h3>Orders needing attention</h3></div><button className="scw-text-button" onClick={() => setShowOrders(true)}>Open orders <FiArrowUpRight /></button></div>
          {pendingOrders.length ? <div className="scw-order-list">{pendingOrders.slice(0, 5).map((order) => {
            const store = storesById.get(order.supermarket_id);
            const worker = workerById.get(order.supplier_id);
            return <button className="scw-order" key={order.id} onClick={() => setShowOrders(true)}><span className="scw-order-icon"><FiBox /></span><span className="scw-row-main"><b>{order.po_number || `Order ${String(order.id).slice(0, 8)}`}</b><small>{store?.name || 'Store'} · {worker?.full_name || order.supplier_name || 'Supplier worker'}</small></span><span className="scw-status review">{statusLabel(order.status)}</span></button>;
          })}</div> : <div className="scw-empty-inline">No orders are waiting for action.</div>}
        </div>
        <div className="scw-card">
          <div className="scw-section-head compact"><div><span className="scw-kicker">Product movement</span><h3>Fast moving products</h3></div><FiActivity className="scw-head-icon" /></div>
          {movingProducts.length ? <div className="scw-moving-list">{movingProducts.slice(0, 5).map((product, index) => <div className="scw-moving" key={product.id}><span className="scw-moving-rank">0{index + 1}</span><span className="scw-row-main"><b>{product.name}</b><small>Fulfilled order quantities</small></span><strong>{product.units}<small> units</small></strong></div>)}</div> : <div className="scw-empty-inline">Completed supplier orders will show product movement here.</div>}
        </div>
      </section>
    </>}
  </main>;
};

function StoreProducts({ storeId, worker, products, stock, orders }) {
  const workerIds = idSet(worker.id, worker.auth_id);
  const workerProducts = products.filter((product) => workerIds.includes(product.supplier_user_id)
    && (!product.supermarket_id || product.supermarket_id === storeId));
  const productMap = new Map(workerProducts.map((product) => [product.id, product]));
  const orderLines = orders.filter((order) => order.supermarket_id === storeId).flatMap((order) => Array.isArray(order.items) ? order.items : []);
  const orderProductIds = idSet(orderLines.map(lineProductId));
  const productRows = idSet(workerProducts.map((product) => product.id), orderProductIds).map((id) => {
    const product = productMap.get(id) || orderLines.find((line) => lineProductId(line) === id) || {};
    const inventoryRow = stock.find((row) => row.supermarket_id === storeId && row.product_id === id);
    const itemStatus = product.supplier_link_active === false ? 'inactive' : product.is_active === false ? 'inactive' : 'active';
    return { id, name: product.name || product.product_name || 'Product', sku: product.sku, quantity: inventoryRow?.quantity, reorderLevel: inventoryRow?.reorder_level, itemStatus };
  });
  return <div className="scw-products">
    <div className="scw-products-head"><b>Products supplied</b><span>{productRows.length} products</span></div>
    {productRows.length ? <div className="scw-product-table"><div className="scw-product-labels"><span>Product</span><span>Store stock</span><span>Catalog status</span></div>
      {productRows.map((product) => {
        const lowStock = product.quantity != null && Number(product.quantity) <= Number(product.reorderLevel ?? 0);
        return <div className="scw-product-row" key={product.id}><span><b>{product.name}</b>{product.sku && <small>SKU {product.sku}</small>}</span>
          <span className={lowStock ? 'stock-low' : 'stock-good'}>{product.quantity == null ? 'Not tracked' : `${product.quantity} units${lowStock ? ' · reorder' : ''}`}</span>
          <span className={`scw-status ${product.itemStatus === 'active' ? 'active' : 'rejected'}`}>{product.itemStatus}</span>
        </div>;
      })}</div> : <div className="scw-empty-inline">Product details will appear when they are added to the supplier catalog or an order.</div>}
  </div>;
}

function Stat({ icon, label, value, note, tone = '' }) {
  return <article className={`scw-stat ${tone}`}><span className="scw-stat-icon">{icon}</span><span className="scw-kicker">{label}</span><b>{value}</b><small>{note}</small></article>;
}

function Insight({ eyebrow, name, detail, icon }) {
  return <article className="scw-insight"><span className="scw-insight-icon">{icon}</span><div><span className="scw-kicker">{eyebrow}</span><b>{name}</b><small>{detail}</small></div></article>;
}

export default SupplierCompanyWorkspace;
