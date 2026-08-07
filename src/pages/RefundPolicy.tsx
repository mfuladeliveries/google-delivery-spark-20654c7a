import { useEffect } from "react";
import PolicyPageLayout, { PolicySection, PolicyList } from "@/components/PolicyPageLayout";
import { POLICY_VERSIONS } from "@/lib/policies";

const RefundPolicy = () => {
  useEffect(() => {
    document.title = "Refund and Cancellation Policy | Mfula Deliveries";
  }, []);

  return (
    <PolicyPageLayout
      title="Refund and Cancellation Policy"
      intro="This policy explains when a Mfula Deliveries order can be cancelled, when a refund may be issued, and how refunds are processed."
      version={POLICY_VERSIONS.refund}
    >
      <PolicySection heading="1. Customer Cancellation Before Restaurant Acceptance">
        <p>
          You may request to cancel an order before the restaurant or store has accepted it or started
          preparing it. Where no preparation or delivery costs have been incurred, a full refund may be
          issued.
        </p>
      </PolicySection>

      <PolicySection heading="2. Cancellation After Acceptance or Preparation">
        <p>
          Once the restaurant has accepted your order or started preparing it, a cancellation may not
          qualify for a full refund, because food preparation and operational costs may already have
          been incurred. In these cases a partial refund may be considered depending on the
          circumstances.
        </p>
      </PolicySection>

      <PolicySection heading="3. Cancellation After Driver Collection">
        <p>
          Orders generally cannot be cancelled once a driver has collected them from the restaurant or
          store. A refund at this stage will only be considered where it is required by law, or where
          Mfula Deliveries, the restaurant, the store or the driver is responsible for a service
          failure.
        </p>
      </PolicySection>

      <PolicySection heading="4. Restaurant or Platform Cancellation">
        <p>
          Where an order is cancelled for reasons on our side, you should receive an appropriate
          refund. This includes where:
        </p>
        <PolicyList
          items={[
            "The restaurant or store cannot fulfil the order",
            "An item you ordered is unavailable",
            "No eligible driver can be assigned to the order",
            "Your payment cannot be verified",
            "Delivery cannot be completed for operational reasons",
          ]}
        />
      </PolicySection>

      <PolicySection heading="5. Missing, Incorrect or Damaged Items">
        <p>
          Please report a problem within a reasonable period after delivery. To investigate, we require:
        </p>
        <PolicyList
          items={[
            "Your order reference number",
            "Your name",
            "A description of the issue",
            "A photograph, where applicable",
          ]}
        />
        <p>
          Depending on the circumstances and applicable law, a resolution may take the form of a full
          refund, a partial refund, platform credit, or a replacement item.
        </p>
      </PolicySection>

      <PolicySection heading="6. Food Quality Complaints">
        <p>
          Food quality complaints are investigated together with the relevant restaurant or store. A
          refund is not automatic where a complaint is based only on personal taste or preference, but
          genuine quality and food-safety concerns are taken seriously and will be investigated.
        </p>
      </PolicySection>

      <PolicySection heading="7. Customer-Caused Delivery Failure">
        <p>A refund may be declined where a delivery failed because:</p>
        <PolicyList
          items={[
            "You supplied an incorrect or incomplete address",
            "You were unavailable to receive the order",
            "You could not be contacted on the number provided",
            "You refused the order without a valid reason",
            "You requested delivery outside the confirmed delivery area or location",
          ]}
        />
      </PolicySection>

      <PolicySection heading="8. Duplicate or Incorrect Charges">
        <p>
          If you believe you have been charged twice or charged an incorrect amount, please contact us
          with your order reference and payment details. Verified payment errors will be corrected.
        </p>
      </PolicySection>

      <PolicySection heading="9. Refund Processing Time">
        <p>
          Approved refunds are submitted to our payment provider promptly. Depending on your bank or
          payment provider, a refund may take approximately 5 to 10 business days to reflect in your
          account. Mfula Deliveries cannot control or guarantee the exact banking processing period.
        </p>
      </PolicySection>

      <PolicySection heading="10. Refund Method">
        <p>
          Refunds are normally returned to the original payment method used for the order, unless
          another lawful arrangement is agreed with you — for example, platform credit for a future
          order.
        </p>
      </PolicySection>

      <PolicySection heading="11. Chargebacks">
        <p>
          Please contact Mfula Deliveries first so that we can investigate and resolve the matter before
          you initiate a bank chargeback. Most issues can be resolved faster directly with our support
          team.
        </p>
      </PolicySection>

      <PolicySection heading="12. Consumer Rights">
        <p>
          Nothing in this policy limits or excludes any rights you have under the Consumer Protection
          Act 68 of 2008 or any other applicable South African law.
        </p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default RefundPolicy;
