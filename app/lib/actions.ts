'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import prisma from './prisma';

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string()
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await prisma.$executeRaw`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}::uuid, ${amountInCents}, ${status}, ${date}::date)`;

        revalidatePath('/dashboard/invoices');
        redirect('/dashboard/invoices');
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.'
        };
    }
}

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });
    const amountInCents = amount * 100;

    try {
        await prisma.$executeRaw`
            UPDATE invoices
            SET customer_id = ${customerId}::uuid, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}::uuid`;

        revalidatePath('/dashboard/invoices');
        redirect('/dashboard/invoices');
    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }
}

export async function deleteInvoice(id: string) {

    throw new Error('Failed to Delete Invoice');
    try {
        

        await prisma.$executeRaw`DELETE FROM invoices WHERE id = ${id}::uuid`;
        revalidatePath('/dashboard/invoices');

        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
}
