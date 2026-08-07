import { useEffect } from "react";
import PolicyPageLayout, { PolicySection, PolicyList } from "@/components/PolicyPageLayout";
import { POLICY_VERSIONS, formatPolicyDate } from "@/lib/policies";
import { Link } from "react-router-dom";

const TermsAndConditions = () => {
  useEffect(() => {
    document.title = "Terms and Conditions | Mfula Deliveries";
  }, []);

  return (
    <PolicyPageLayout
      title="Terms and Conditions"
      intro="These Terms and Conditions govern your use of the Mfula Deliveries website and application, and every order you place through our platform."
      version={POLICY_VERSIONS.terms}
    >
      <PolicySection heading="1. Introduction">
        <p>
          Mfula Deliveries is an online food and goods ordering and delivery platform. We connect
          customers with participating restaurants and stores, and with independent delivery drivers
          who collect and deliver those orders.
        </p>
        <p>
          Mfula Deliveries does not prepare the food or manufacture the goods sold through the
          platform. Those items are prepared, packaged and supplied by the participating restaurant
          or store you order from.
        </p>
      </PolicySection>

      <PolicySection heading="2. Acceptance of Terms">
        <p>
          By using the Mfula Deliveries website or application, creating an account, or placing an
          order, you accept these Terms and Conditions. If you do not accept them, please do not use
          the platform.
        </p>
        <p>
          Effective date: {formatPolicyDate(POLICY_VERSIONS.terms)}. Last updated:{" "}
          {formatPolicyDate(POLICY_VERSIONS.terms)}.
        </p>
      </PolicySection>

      <PolicySection heading="3. Customer Accounts">
        <p>
          You must provide accurate contact, delivery and payment information when you register and
          when you place an order. Incorrect information can delay or prevent delivery.
        </p>
        <p>
          You are responsible for maintaining the security of your account and password, and for all
          activity that takes place under your account. Please notify us immediately if you believe
          your account has been used without your permission.
        </p>
      </PolicySection>

      <PolicySection heading="4. Ordering Process">
        <p>
          Orders are placed directly through the Mfula Deliveries website or application. Every order
          is subject to:
        </p>
        <PolicyList
          items={[
            "The availability of the restaurant or store and the items you selected",
            "The operating hours of that restaurant or store",
            "Your delivery address passing our delivery eligibility and distance checks",
            "Successful verification of your payment",
          ]}
        />
      </PolicySection>

      <PolicySection heading="5. Product Information and Availability">
        <p>
          Prices, item descriptions, images and availability are supplied or managed by the
          participating restaurants and stores. Images are for illustration and the item you receive
          may differ in presentation.
        </p>
        <p>
          Items may become unavailable after an order has been placed. Where this happens, the
          restaurant or Mfula Deliveries will contact you to arrange a substitution, a partial refund
          or a cancellation.
        </p>
      </PolicySection>

      <PolicySection heading="6. Pricing and Fees">
        <p>
          The total amount payable is displayed to you before you confirm payment. That total may
          include:
        </p>
        <PolicyList
          items={[
            "The product or food cost charged by the restaurant or store",
            "The delivery fee applicable to your address",
            "Any clearly disclosed service or platform fee",
            "An optional driver tip, if you choose to add one",
          ]}
        />
        <p>All prices are shown in South African Rand (ZAR).</p>
      </PolicySection>

      <PolicySection heading="7. Payments">
        <p>
          Payments are processed through an authorised payment provider. An order is only confirmed
          once payment has been successfully verified.
        </p>
        <p>
          Mfula Deliveries may collect the full payment from you and thereafter settle the
          restaurant's or store's portion in accordance with the applicable agreement between us and
          that partner.
        </p>
      </PolicySection>

      <PolicySection heading="8. Order Acceptance">
        <p>
          Submitting and paying for an order does not guarantee that the order will be accepted. A
          restaurant or store may reject an order because an item is unavailable, because it is
          closing, because of operational issues, or for other reasonable circumstances.
        </p>
        <p>
          Where an order is rejected, you will be refunded in accordance with our{" "}
          <Link to="/refund-policy" className="font-semibold text-primary underline">
            Refund and Cancellation Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection heading="9. Delivery">
        <p>
          Delivery times shown on the platform are estimates only. They may be affected by traffic,
          weather, restaurant preparation time, incorrect addresses, your availability, driver
          availability, or other circumstances outside the control of Mfula Deliveries. Full details
          are set out in our{" "}
          <Link to="/delivery-policy" className="font-semibold text-primary underline">
            Delivery and Shipping Policy
          </Link>
          .
        </p>
      </PolicySection>

      <PolicySection heading="10. Customer Responsibilities">
        <p>As a customer you must:</p>
        <PolicyList
          items={[
            "Enter a complete and accurate delivery address, including suburb and unit or house number",
            "Provide a working telephone number that you can be reached on",
            "Remain available to receive the delivery",
            "Provide access instructions, gate codes or directions where these are needed",
            "Check your order promptly after delivery and report any problem as soon as reasonably possible",
          ]}
        />
      </PolicySection>

      <PolicySection heading="11. Delivery Drivers">
        <p>
          Delivery drivers may operate as independent contractors using their own vehicles or
          motorcycles. Drivers are responsible for complying with all applicable licensing, roadworthy,
          insurance, safety and vehicle requirements.
        </p>
        <p>
          We expect courteous conduct from drivers and customers alike. Abuse, harassment or
          threatening behaviour towards a driver, restaurant employee or customer may result in a
          refusal of service.
        </p>
      </PolicySection>

      <PolicySection heading="12. Cancellations and Refunds">
        <p>
          Cancellations, refunds, missing items and quality complaints are dealt with in our{" "}
          <Link to="/refund-policy" className="font-semibold text-primary underline">
            Refund and Cancellation Policy
          </Link>
          , which forms part of these Terms and Conditions.
        </p>
      </PolicySection>

      <PolicySection heading="13. Prohibited Use">
        <p>You may not:</p>
        <PolicyList
          items={[
            "Misuse the platform or attempt to interfere with its operation or security",
            "Place fraudulent, false or malicious orders",
            "Use payment details that you are not authorised to use",
            "Abuse, threaten or harass drivers, restaurant staff or our support team",
            "Use the platform for any unlawful purpose or to order items you may not lawfully receive",
            "Copy, scrape or resell platform content or data without our written permission",
          ]}
        />
        <p>
          We may suspend or terminate an account that is used in breach of this section.
        </p>
      </PolicySection>

      <PolicySection heading="14. Limitation of Liability">
        <p>
          Mfula Deliveries will take reasonable steps to provide a reliable service, but we are not
          responsible for delays, interruptions or failures caused by circumstances outside our
          reasonable control, including load shedding, network or payment provider outages, extreme
          weather, road closures, protest action or restaurant closures.
        </p>
        <p>
          Nothing in these Terms excludes or limits any liability that may not lawfully be excluded or
          limited under South African law, including the Consumer Protection Act 68 of 2008.
        </p>
      </PolicySection>

      <PolicySection heading="15. Privacy">
        <p>
          We collect and process personal information such as your name, contact number, delivery
          address and order history in order to provide the service. Personal information is handled
          in accordance with applicable South African data protection law, including the Protection of
          Personal Information Act 4 of 2013, and our Privacy Policy.
        </p>
        <p>
          Your name, contact number and delivery address are shared with the relevant restaurant and
          the assigned driver only to the extent needed to prepare and deliver your order.
        </p>
      </PolicySection>

      <PolicySection heading="16. Changes to the Terms">
        <p>
          Mfula Deliveries may update these Terms and Conditions from time to time. The effective date
          and last updated date are displayed at the top of this page. Continuing to use the platform
          after an update means you accept the updated Terms.
        </p>
      </PolicySection>

      <PolicySection heading="17. Governing Law">
        <p>
          These Terms and Conditions are governed by and interpreted in accordance with the laws of
          the Republic of South Africa.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default TermsAndConditions;
