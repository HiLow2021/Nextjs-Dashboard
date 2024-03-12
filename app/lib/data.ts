import { sql } from '@vercel/postgres';
import { unstable_noStore as noStore } from 'next/cache';
import { CustomerField, CustomersTableType, InvoiceForm, InvoicesTable, LatestInvoiceRaw, Revenue, User } from './definitions';
import prisma from './prisma';
import { formatCurrency } from './utils';

export async function fetchRevenue() {
    // Add noStore() here to prevent the response from being cached.
    // This is equivalent to in fetch(..., {cache: 'no-store'}).
    noStore();

    try {
        // We artificially delay a response for demo purposes.
        // Don't do this in production :)
        console.log('Fetching revenue data...');
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const data = await prisma.$queryRaw<Revenue[]>`SELECT * FROM revenue`;

        console.log('Data fetch completed after 3 seconds.');

        return data;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch revenue data.');
    }
}

export async function fetchLatestInvoices() {
    noStore();

    try {
        const data = await prisma.$queryRaw<LatestInvoiceRaw[]>`
            SELECT invoices.amount, customers.name, customers.image_url, customers.email, invoices.id
            FROM invoices
            JOIN customers ON invoices.customer_id = customers.id
            ORDER BY invoices.date DESC
            LIMIT 5`;

        const latestInvoices = data.map((invoice) => ({
            ...invoice,
            amount: formatCurrency(invoice.amount)
        }));

        return latestInvoices;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch the latest invoices.');
    }
}

export async function fetchCardData() {
    noStore();

    try {
        // You can probably combine these into a single SQL query
        // However, we are intentionally splitting them to demonstrate
        // how to initialize multiple queries in parallel with JS.
        const invoiceCount = await prisma.$queryRaw<any>`SELECT COUNT(*)::integer FROM invoices`;
        const customerCount = await prisma.$queryRaw<any>`SELECT COUNT(*)::integer FROM customers`;
        const invoiceStatus = await prisma.$queryRaw<any>`SELECT
            SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)::integer AS "paid",
            SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END)::integer AS "pending"
            FROM invoices`;

        const numberOfInvoices = invoiceCount[0]?.count;
        const numberOfCustomers = customerCount[0]?.count;
        const totalPaidInvoices = formatCurrency(invoiceStatus[0]?.paid ?? '0');
        const totalPendingInvoices = formatCurrency(invoiceStatus[0]?.pending ?? '0');

        return {
            numberOfInvoices,
            numberOfCustomers,
            totalPaidInvoices,
            totalPendingInvoices
        };
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch card data.');
    }
}

const ITEMS_PER_PAGE = 6;
export async function fetchFilteredInvoices(query: string, currentPage: number) {
    noStore();

    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    try {
        const invoices = await prisma.$queryRaw<InvoicesTable[]>`
            SELECT
              invoices.id,
              invoices.amount,
              invoices.date,
              invoices.status,
              customers.name,
              customers.email,
              customers.image_url
            FROM invoices
            JOIN customers ON invoices.customer_id = customers.id
            WHERE
              customers.name ILIKE ${`%${query}%`} OR
              customers.email ILIKE ${`%${query}%`} OR
              invoices.amount::text ILIKE ${`%${query}%`} OR
              invoices.date::text ILIKE ${`%${query}%`} OR
              invoices.status ILIKE ${`%${query}%`}
            ORDER BY invoices.date DESC
            LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}`;

        return invoices;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoices.');
    }
}

export async function fetchInvoicesPages(query: string) {
    noStore();

    try {
        const count = await prisma.$queryRaw<any>`SELECT COUNT(*)
            FROM invoices
            JOIN customers ON invoices.customer_id = customers.id
            WHERE
              customers.name ILIKE ${`%${query}%`} OR
              customers.email ILIKE ${`%${query}%`} OR
              invoices.amount::text ILIKE ${`%${query}%`} OR
              invoices.date::text ILIKE ${`%${query}%`} OR
              invoices.status ILIKE ${`%${query}%`}`;

        const totalPages = Math.ceil(Number(count[0].count) / ITEMS_PER_PAGE);

        return totalPages;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch total number of invoices.');
    }
}

export async function fetchInvoiceById(id: string) {
    noStore();

    try {
        const data = await sql<InvoiceForm>`
            SELECT
              invoices.id,
              invoices.customer_id,
              invoices.amount,
              invoices.status
            FROM invoices
            WHERE invoices.id = ${id};`;

        const invoice = data.rows.map((invoice) => ({
            ...invoice,
            // Convert amount from cents to dollars
            amount: invoice.amount / 100
        }));

        return invoice[0];
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch invoice.');
    }
}

export async function fetchCustomers() {
    noStore();

    try {
        const customers = await prisma.$queryRaw<CustomerField[]>`
            SELECT
              id,
              name
            FROM customers
            ORDER BY name ASC`;

        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch all customers.');
    }
}

export async function fetchFilteredCustomers(query: string) {
    noStore();

    try {
        const data = await sql<CustomersTableType>`
		    SELECT
		      customers.id,
		      customers.name,
		      customers.email,
		      customers.image_url,
		      COUNT(invoices.id) AS total_invoices,
		      SUM(CASE WHEN invoices.status = 'pending' THEN invoices.amount ELSE 0 END) AS total_pending,
		      SUM(CASE WHEN invoices.status = 'paid' THEN invoices.amount ELSE 0 END) AS total_paid
		    FROM customers
		    LEFT JOIN invoices ON customers.id = invoices.customer_id
		    WHERE
		      customers.name ILIKE ${`%${query}%`} OR
            customers.email ILIKE ${`%${query}%`}
		    GROUP BY customers.id, customers.name, customers.email, customers.image_url
		    ORDER BY customers.name ASC`;

        const customers = data.rows.map((customer) => ({
            ...customer,
            total_pending: formatCurrency(customer.total_pending),
            total_paid: formatCurrency(customer.total_paid)
        }));

        return customers;
    } catch (err) {
        console.error('Database Error:', err);
        throw new Error('Failed to fetch customer table.');
    }
}

export async function getUser(email: string) {
    try {
        const user = await sql`SELECT * FROM users WHERE email=${email}`;
        return user.rows[0] as User;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}
