/**
 * @jest-environment jsdom
 */

import {fireEvent, screen, waitFor} from "@testing-library/dom"
import BillsUI from "../views/BillsUI.js"
import {bills} from "../fixtures/bills.js"
import {ROUTES_PATH} from "../constants/routes.js";
import {localStorageMock} from "../__mocks__/localStorage.js";
import mockStore from "../__mocks__/store";
import router from "../app/Router.js";
import Bills from "../containers/Bills.js";
import '@testing-library/jest-dom/extend-expect';

jest.mock("../app/Store", () => mockStore)

describe("Given I am connected as an employee", () => {
  describe("When I am on Bills Page", () => {
    test("Then bill icon in vertical layout should be highlighted", async () => {

      Object.defineProperty(window, 'localStorage', {value: localStorageMock})
      window.localStorage.setItem('user', JSON.stringify({
        type: 'Employee'
      }))
      const root = document.createElement("div")
      root.setAttribute("id", "root")
      document.body.append(root)
      router()
      window.onNavigate(ROUTES_PATH.Bills)
      await waitFor(() => screen.getByTestId('icon-window'))
      const windowIcon = screen.getByTestId('icon-window')
      //to-do write expect expression
      expect(windowIcon.classList.contains('active-icon')).toBe(true)

    })

    test("Then bills should be ordered from latest to earliest", () => {
      document.body.innerHTML = BillsUI({data: bills})

      // Récupérer toutes les cellules de date avec getAllByTestId
      const dateCells = screen.getAllByTestId('bill-date')

      // Extraire les dates originales depuis l'attribut data-date
      const dates = dateCells.map(cell => cell.getAttribute('data-date'))

      // Fonction de tri anti-chronologique (du plus récent au plus ancien)
      const antiChrono = (a, b) => ((a < b) ? 1 : -1)
      const datesSorted = [...dates].sort(antiChrono)

      // Vérifier que les dates sont triées du plus récent au plus ancien
      expect(dates).toEqual(datesSorted)
    })

    test("Then I should be able to click on new bill button to navigate to NewBill page", () => {
      // Créer un mock pour onNavigate
      const onNavigate = jest.fn()

      // Créer le HTML de la page Bills (avec le bouton btn-new-bill)
      document.body.innerHTML = BillsUI({data: bills})

      // Instancier la classe Bills avec le mock onNavigate
      new Bills({
        document,
        onNavigate,
        store: null,
        localStorage: null
      })

      // Récupérer le bouton et simuler le clic
      const buttonNewBill = screen.getByTestId('btn-new-bill')
      fireEvent.click(buttonNewBill)

      // Vérifier que onNavigate a été appelé avec la bonne route
      expect(onNavigate).toHaveBeenCalledWith(ROUTES_PATH['NewBill'])
    })

    test("Then clicking eye icon should trigger modal display", () => {

      // Mocker jQuery
      $.fn.modal = jest.fn()
      $.fn.find = jest.fn().mockReturnValue({
        html: jest.fn()
      })
      $.fn.width = jest.fn().mockReturnValue(500)

      // Initialiser l'UI pour ensuite récupérer l'icône
      document.body.innerHTML = BillsUI({data: bills})
      new Bills({
        document,
        onNavigate: null,
        store: null,
        localStorage: null
      });
// Récupérer le premier élement icon eye
      const iconEye = screen.getAllByTestId('icon-eye')[0]
      fireEvent.click(iconEye)

      // Vérifier que modal() a été appelé avec 'show'
      expect($.fn.modal).toHaveBeenCalledWith('show')
    })
  })
})

// test d'intégration GET
describe("Given I am a user connected as employee", () => {
  describe("When I navigate to Bills", () => {
    // Fonction utilitaire pour la configuration commune
    const setupTestEnvironment = () => {
      document.body.innerHTML = '';

      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        writable: true
      });

      window.localStorage.setItem(
        "user",
        JSON.stringify({type: "Employee", email: "john.doe@gmail.com"})
      );

      const root = document.createElement("div");
      root.setAttribute("id", "root");
      document.body.append(root);

      jest.clearAllMocks();
    };

    beforeEach(() => {
      setupTestEnvironment();
      router();
    });

    afterEach(() => {
      document.body.innerHTML = '';
      jest.clearAllMocks();
    });

    test("fetches bills from mock API GET", async () => {
      // Spy sur le mock pour vérifier l'appel API
      const billsListSpy = jest.spyOn(mockStore.bills(), 'list');
      window.onNavigate(ROUTES_PATH.Bills);

      // Vérifier que l'API a été appelée
      await waitFor(() => {
        expect(billsListSpy).toHaveBeenCalled();
      });

      // Vérifier que la page de chargement puis le contenu sont affichés
      await waitFor(() => screen.getByText("Mes notes de frais"), {
        timeout: 3000
      });

      // Vérifier que le bouton est présent et visible
      const newBillButton = screen.getByText("Nouvelle note de frais");
      expect(newBillButton).toBeInTheDocument();
      expect(newBillButton).toBeVisible();

      // Vérifier que les données sont affichées dans le tableau
      const tableBody = screen.getByTestId("tbody");
      expect(tableBody).toBeInTheDocument();

      // Vérifier qu'il y a des lignes de bills (optionnel, selon les données mockées)
      const rows = tableBody.querySelectorAll('tr');
      expect(rows.length).toBeGreaterThan(0);
    });

    // Test erreurs API
    describe("When an error occurs on API", () => {
      beforeEach(() => {
       jest.spyOn(mockStore, "bills")
      })

      test("fetches bills from an API and fails with 404 message error", async () => {

        mockStore.bills.mockImplementationOnce(() => {
          return {
            list: () => {
              return Promise.reject(new Error("Erreur 404"))
            }
          }
        })
        window.onNavigate(ROUTES_PATH.Bills)
        await new Promise(process.nextTick);
        const message = await screen.getByText(/Erreur 404/)
        expect(message).toBeTruthy()
      })

      test("fetches messages from an API and fails with 500 message error", async () => {

        mockStore.bills.mockImplementationOnce(() => {
          return {
            list: () => {
              return Promise.reject(new Error("Erreur 500"))
            }
          }
        })

        window.onNavigate(ROUTES_PATH.Bills)
        await new Promise(process.nextTick);
        const message = await screen.getByText(/Erreur 500/)
        expect(message).toBeTruthy()
      })
    })
  });
});
