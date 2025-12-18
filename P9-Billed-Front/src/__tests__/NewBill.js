/**
 * @jest-environment jsdom
 */

import { fireEvent, screen, waitFor } from "@testing-library/dom"
import NewBillUI from "../views/NewBillUI.js"
import NewBill from "../containers/NewBill.js"
import { ROUTES_PATH } from "../constants/routes.js"
import { localStorageMock } from "../__mocks__/localStorage.js"
import mockStore from "../__mocks__/store.js"
import '@testing-library/jest-dom/extend-expect'
import userEvent from "@testing-library/user-event";

jest.mock("../app/Store", () => mockStore)
global.alert = jest.fn()

// Helper pour simuler un changement de fichier
const simulateFileChange = (newBill, fileName, fileType) => {
  const fileInput = screen.getByTestId('file')
  const file = new File(['test'], fileName, { type: fileType })
  Object.defineProperty(fileInput, 'files', { value: [file], writable: false, configurable: true })

  const mockTarget = { value: `C:\\fakepath\\${fileName}` }
  newBill.handleChangeFile({ preventDefault: jest.fn(), target: mockTarget })
  return mockTarget
}

// Helper pour créer une instance NewBillUI
const createNewBillInstance = (onNavigate = jest.fn()) => {
  document.body.innerHTML = NewBillUI()
  return new NewBill({
    document,
    onNavigate,
    store: mockStore,
    localStorage: window.localStorage
  })
}

describe("Given I am connected as an employee", () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })
    window.localStorage.setItem('user', JSON.stringify({ type: 'Employee', email: 'employee@test.tld' }))
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  describe("When I select a file", () => {
    test("Then handleChangeFile should accept valid image files (jpg, jpeg, png)", async () => {
      const newBill = createNewBillInstance()
      simulateFileChange(newBill, 'test.jpg', 'image/jpeg')

      await waitFor(() => {
        expect(newBill.fileUrl).toBe('https://localhost:3456/images/test.jpg')
        expect(newBill.fileName).toBe('test.jpg')
        expect(newBill.billId).toBe('1234')
        expect(global.alert).not.toHaveBeenCalled()
      })
    })

    test("Then handleChangeFile should reject invalid file types", () => {
      const newBill = createNewBillInstance()
      const mockTarget = simulateFileChange(newBill, 'test.pdf', 'application/pdf')

      expect(global.alert).toHaveBeenCalledWith('Seuls les fichiers aux formats jpg, jpeg ou png sont autorisés.')
      expect(mockTarget.value).toBe('')
    })
  })

  describe("When I submit the form", () => {
    test("Then handleSubmit should create a bill and navigate to Bills page", async () => {
      const onNavigate = jest.fn()
      const newBill = createNewBillInstance(onNavigate)

      simulateFileChange(newBill, 'test.jpg', 'image/jpeg')
      await waitFor(() => expect(newBill.fileUrl).toBe('https://localhost:3456/images/test.jpg'))

      fireEvent.change(screen.getByTestId('expense-type'), { target: { value: 'Transports' } })
      fireEvent.change(screen.getByTestId('expense-name'), { target: { value: 'Vol Paris Londres' } })
      fireEvent.change(screen.getByTestId('datepicker'), { target: { value: '2024-01-15' } })
      fireEvent.change(screen.getByTestId('amount'), { target: { value: '500' } })
      fireEvent.change(screen.getByTestId('vat'), { target: { value: '100' } })
      fireEvent.change(screen.getByTestId('pct'), { target: { value: '20' } })
      fireEvent.change(screen.getByTestId('commentary'), { target: { value: 'Test commentary' } })

      fireEvent.submit(screen.getByTestId('form-new-bill'))
      expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH['Bills'])
    })
  })

  describe("Given I am a user connected as employee - Integration test", () => {
    test("Then the complete flow should work: file upload -> form submission -> navigation", async () => {
      const onNavigate = jest.fn()
      const createSpy = jest.spyOn(mockStore.bills(), 'create')
      const updateSpy = jest.spyOn(mockStore.bills(), 'update')
      const newBill = createNewBillInstance(onNavigate)

      simulateFileChange(newBill, 'facture.jpg', 'image/jpeg')
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalled()
        expect(newBill.fileUrl).toBe('https://localhost:3456/images/test.jpg')
        expect(newBill.fileName).toBe('facture.jpg')
      })

      await userEvent.selectOptions(screen.getByTestId('expense-type'), 'Hôtel et logement')
      await userEvent.type(screen.getByTestId('expense-name'), 'Hôtel Paris')
      await userEvent.type(screen.getByTestId('datepicker'), '2024-01-20')
      await userEvent.type(screen.getByTestId('amount'), '200')
      await userEvent.type(screen.getByTestId('vat'), '40')
      await userEvent.type(screen.getByTestId('pct'), '20')
      await userEvent.type(screen.getByTestId('commentary'), 'Séjour professionnel')

      const submitBtn = screen.getByText("Envoyer");
      userEvent.click(submitBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled()
        const billData = JSON.parse(updateSpy.mock.calls[0][0].data)
        expect(billData.type).toBe('Hôtel et logement')
        expect(billData.status).toBe('pending')
        expect(updateSpy.mock.calls[0][0].selector).toBe('1234')
      })

      expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH['Bills'])
    })
  })
})
