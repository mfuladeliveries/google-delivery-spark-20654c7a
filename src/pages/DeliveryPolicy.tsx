import { useEffect } from "react";
import PolicyPageLayout, { PolicySection, PolicyList } from "@/components/PolicyPageLayout";
import { POLICY_VERSIONS } from "@/lib/policies";

const DeliveryPolicy = () => {
  useEffect(() => {
    document.title = "Delivery and Shipping Policy | Mfula Deliveries";
  }, []);

  return (
    <PolicyPageLayout
      title="Delivery and Shipping Policy"
      intro="Mfula Deliveries mainly provides local, on-demand delivery from nearby restaurants and stores rather than traditional courier or parcel shipping. This policy explains how our deliveries work."
      version={POLICY_VERSIONS.delivery}
    >
      <PolicySection heading="1. Delivery Areas">
        <p>
          Mfula Deliveries only accepts orders within our supported delivery areas. Your delivery
          address must pass the platform's delivery eligibility and distance checks before an order
          can be placed.
        </p>
        <p>
          If your address falls outside a supported area, the platform will tell you at checkout and
          the order cannot be completed. Supported areas may change as we expand or adjust operations.
        </p>
      </PolicySection>

      <PolicySection heading="2. Delivery Fees">
        <p>
          Delivery fees are calculated according to factors such as distance, your location, the
          restaurant or store branch, and operational costs. Peak-time surcharges may apply during
          busy periods.
        </p>
        <p>
          The delivery fee that applies to your order is always shown to you before checkout, as part
          of the order total.
        </p>
      </PolicySection>

      <PolicySection heading="3. Delivery Process">
        <PolicyList
          items={[
            "You select a restaurant or store.",
            "You select the products you want.",
            "You provide your delivery address.",
            "The platform verifies that your address is eligible for delivery.",
            "You review the total amount, including the delivery fee.",
            "Payment is completed through our authorised payment provider.",
            "The restaurant or store prepares your order.",
            "A driver is assigned to your order.",
            "The driver collects the order and delivers it to your address.",
            "You can track the status of your order through the platform.",
          ]}
        />
      </PolicySection>

      <PolicySection heading="4. Delivery Time">
        <p>
          Delivery times shown on the platform are estimates and are not guaranteed. Delays may arise
          from:
        </p>
        <PolicyList
          items={[
            "Restaurant or store preparation times",
            "Traffic or road conditions",
            "Weather",
            "Unusually high demand",
            "Driver availability",
            "Road closures or restricted access",
            "Incorrect or incomplete customer information",
          ]}
        />
      </PolicySection>

      <PolicySection heading="5. Address Accuracy">
        <p>
          You are responsible for entering the correct street address, suburb, contact number, unit or
          house number, gate code and any delivery instructions. Please double-check your address
          before confirming an order — an incorrect address is the most common cause of a failed
          delivery.
        </p>
      </PolicySection>

      <PolicySection heading="6. Failed Delivery">
        <p>A delivery may be treated as unsuccessful where:</p>
        <PolicyList
          items={[
            "You cannot be reached on the contact number provided",
            "The address is incorrect or incomplete",
            "The driver cannot safely access the location",
            "You fail to collect or receive the order",
            "You ask the driver to deliver to a location other than the confirmed delivery address",
          ]}
        />
        <p>
          Where a second delivery attempt is arranged, an additional delivery charge may apply. Food
          that has spoiled because of a failed delivery caused by incorrect customer information may
          not be refundable.
        </p>
      </PolicySection>

      <PolicySection heading="7. Contactless Delivery">
        <p>
          Where available, you may request contactless delivery and ask the driver to leave your order
          at an agreed location. Once the order has been left at that agreed location, responsibility
          for the order passes to you.
        </p>
      </PolicySection>

      <PolicySection heading="8. Damaged, Missing or Incorrect Items">
        <p>
          Please report damaged, missing or incorrect items as soon as reasonably possible after
          delivery. When reporting a problem, provide:
        </p>
        <PolicyList
          items={[
            "Your order reference number",
            "A clear description of the problem",
            "Supporting photographs, where applicable",
          ]}
        />
        <p>
          These reports are handled in accordance with our Refund and Cancellation Policy.
        </p>
      </PolicySection>

      <PolicySection heading="9. Restricted Delivery">
        <p>
          Mfula Deliveries may refuse a delivery where the location is unsafe, inaccessible, outside
          our operating area, or where delivery is prohibited by law. Age-restricted items will not be
          handed over where the recipient cannot lawfully receive them.
        </p>
      </PolicySection>

      <PolicySection heading="10. Customer Verification">
        <p>
          Before handing over an order, the driver may request your name, order number, delivery PIN,
          or another reasonable form of verification. This protects you against your order being
          handed to the wrong person.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default DeliveryPolicy;
