import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ServiceForm from '../ServiceForm.vue';
import { servicesApi } from '../../../services/api';
import { createRouter, createWebHistory } from 'vue-router';

// Mock the API
vi.mock('../../../services/api', () => ({
  servicesApi: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn()
  }
}));

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/config', component: { template: 'List' } },
    { path: '/config/services/:id', component: { template: 'Detail' } }
  ]
});

describe('ServiceForm.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate valid baseUrl with https', async () => {
    const wrapper = mount(ServiceForm, {
      global: {
        plugins: [router]
      }
    });

    const nameInput = wrapper.find('input[placeholder="e.g. Authentication API"]');
    await nameInput.setValue('Test Service');

    const baseUrlInput = wrapper.find('input[placeholder="https://auth-api.internal.com/v1"]');
    await baseUrlInput.setValue('https://megarelatorios.megalinkpiaui.com.br');

    const form = wrapper.find('form');
    await form.trigger('submit.prevent');

    // Should not have baseUrl error
    expect(wrapper.text()).not.toContain('Base URL precisa começar com http:// ou https://');
  });

  it('should show error for invalid baseUrl', async () => {
    const wrapper = mount(ServiceForm, {
      global: {
        plugins: [router]
      }
    });

    const baseUrlInput = wrapper.find('input[placeholder="https://auth-api.internal.com/v1"]');
    await baseUrlInput.setValue('ftp://invalid.url');

    const form = wrapper.find('form');
    await form.trigger('submit.prevent');

    expect(wrapper.text()).toContain('Base URL precisa começar com http:// ou https://');
  });

  it('should display error from API correctly', async () => {
    const apiError = new Error('Database connection failed');
    (servicesApi.create as any).mockRejectedValue(apiError);

    const wrapper = mount(ServiceForm, {
      global: {
        plugins: [router]
      }
    });

    await wrapper.find('input[placeholder="e.g. Authentication API"]').setValue('Test Service');
    await wrapper.find('input[placeholder="e.g. microservices"]').setValue('test-group');
    await wrapper.find('input[placeholder="e.g. production"]').setValue('prod');

    const form = wrapper.find('form');
    await form.trigger('submit.prevent');

    // Wait for the async cleanup
    await vi.waitFor(() => {
      expect(wrapper.find('.error-msg').text()).toBe('Database connection failed');
    });
  });

  it('should not blame baseUrl for name error from API', async () => {
    // Simulate a specific error that is NOT baseUrl but might be misdiagnosed
    const apiError = new Error('Name cannot be empty');
    (servicesApi.create as any).mockRejectedValue(apiError);

    const wrapper = mount(ServiceForm, {
      global: {
        plugins: [router]
      }
    });

    // Provide valid baseUrl but fail on name (according to mock)
    await wrapper.find('input[placeholder="e.g. Authentication API"]').setValue('Test');
    await wrapper.find('input[placeholder="https://auth-api.internal.com/v1"]').setValue('https://valid.com');

    const form = wrapper.find('form');
    await form.trigger('submit.prevent');

    await vi.waitFor(() => {
      expect(wrapper.find('.error-msg').text()).toBe('Preencha um nome de serviço válido');
      expect(wrapper.find('.error-msg').text()).not.toContain('Base URL');
    });
  });
});
